import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/integrations/auth-middleware";

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
        familyId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(200).optional(),
      })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { query } = await import("@/lib/db");
    const { mapPayment } = await import("@/lib/api/mappers");
    const { getOwnedFamilyId } = await import("@/lib/api/access");

    const status = data?.status ?? "all";
    const limit = data?.limit ?? 200;
    let familyFilter: string | null = data?.familyId ?? null;

    if (!context.isAdmin) {
      familyFilter = await getOwnedFamilyId(context.userId);
      if (!familyFilter) return [];
    }

    const rows = await query(
      `SELECT
          id, voucher_no, family_id, family_due_id, paid_by, mode, amount, payment_date, txn_ref,
          screenshot_url, remarks, status, admin_remarks, approved_by, approved_at,
          created_by, created_at
       FROM payments
       WHERE (@familyId IS NULL OR family_id = @familyId)
         AND (@status = 'all' OR status = @status)
       ORDER BY payment_date DESC, created_at DESC
       LIMIT @limit`,
      { limit, familyId: familyFilter, status },
    );
    return rows.map(mapPayment);
  });

export const getPaymentById = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { queryOne } = await import("@/lib/db");
    const { mapPayment } = await import("@/lib/api/mappers");
    const { assertCanAccessFamily } = await import("@/lib/api/access");

    const row = await queryOne(`SELECT * FROM payments WHERE id = @id`, { id: data.id });
    if (!row) throw new Error("Payment not found");
    await assertCanAccessFamily(context.userId, context.isAdmin, String(row.family_id));
    const family = await queryOne<{
      family_no: string;
      family_name: string;
      contact_phone: string | null;
    }>(`SELECT family_no, family_name, contact_phone FROM families WHERE id = @id`, {
      id: row.family_id,
    });

    let dueTitle: string | null = null;
    if (row.family_due_id) {
      const due = await queryOne<{ title: string }>(
        `SELECT pd.title
         FROM family_dues d
         INNER JOIN payment_demands pd ON pd.id = d.demand_id
         WHERE d.id = @id`,
        { id: row.family_due_id },
      );
      dueTitle = due?.title ? String(due.title) : null;
    }

    return {
      payment: mapPayment(row),
      family: family
        ? {
            family_no: family.family_no,
            family_name: family.family_name,
            contact_phone: family.contact_phone,
          }
        : null,
      dueTitle,
    };
  });

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        family_id: z.string().uuid(),
        family_due_id: z.string().uuid().optional().nullable(),
        amount: z.number().positive(),
        mode: z.enum(["cash", "online"]),
        payment_date: z.string().min(8).max(20),
        txn_ref: z.string().trim().max(100).optional().nullable(),
        paid_by: z.string().trim().max(200).optional().nullable(),
        remarks: z.string().trim().max(1000).optional().nullable(),
        screenshot_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { execute, queryOne } = await import("@/lib/db");
    const { assertCanAccessFamily } = await import("@/lib/api/access");

    if (context.isAdmin) throw new Error("Administrators review payments; families submit them");
    await assertCanAccessFamily(context.userId, false, data.family_id);

    if (data.mode === "online" && !data.txn_ref) {
      throw new Error("Transaction reference is required");
    }
    if (data.mode === "online" && !data.screenshot_url) {
      throw new Error("Please attach the payment screenshot");
    }

    let familyDueId: string | null = data.family_due_id || null;
    if (familyDueId) {
      const due = await queryOne<{
        id: string;
        family_id: string;
        amount_due: number;
        demand_status: string;
      }>(
        `SELECT d.id, d.family_id, d.amount_due, pd.status AS demand_status
         FROM family_dues d
         INNER JOIN payment_demands pd ON pd.id = d.demand_id
         WHERE d.id = @id`,
        { id: familyDueId },
      );
      if (!due) throw new Error("Due not found");
      if (String(due.family_id) !== data.family_id) throw new Error("Due does not belong to this family");
      if (due.demand_status !== "open") throw new Error("This due is closed");

      const paid = await queryOne<{ approved: number; pending: number }>(
        `SELECT
            COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending
         FROM payments
         WHERE family_due_id = @id`,
        { id: familyDueId },
      );
      const payable = Math.max(
        0,
        Number(due.amount_due) - Number(paid?.approved ?? 0) - Number(paid?.pending ?? 0),
      );
      if (data.amount > payable + 0.001) {
        throw new Error(`Amount exceeds remaining payable (${payable.toFixed(2)})`);
      }
    }

    await execute(
      `INSERT INTO payments
         (family_id, family_due_id, created_by, status, amount, mode, payment_date, txn_ref, paid_by, remarks, screenshot_url)
       VALUES
         (@familyId, @familyDueId, @createdBy, 'pending', @amount, @mode, @paymentDate, @txnRef, @paidBy, @remarks, @screenshot)`,
      {
        familyId: data.family_id,
        familyDueId,
        createdBy: context.userId,
        amount: data.amount,
        mode: data.mode,
        paymentDate: data.payment_date,
        txnRef: data.txn_ref || null,
        paidBy: data.paid_by || null,
        remarks: data.remarks || null,
        screenshot: data.screenshot_url || null,
      },
    );
    return { ok: true };
  });

export const decidePayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        remarks: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { execute } = await import("@/lib/db");
    await execute(
      `UPDATE payments
       SET status = @status,
           admin_remarks = @remarks,
           approved_by = @approvedBy,
           approved_at = now()
       WHERE id = @id AND status = 'pending'`,
      {
        id: data.id,
        status: data.status,
        remarks: data.remarks || null,
        approvedBy: context.userId,
      },
    );
    return { ok: true };
  });

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("@/lib/db");
    const { getOwnedFamilyId } = await import("@/lib/api/access");

    let familyId: string | null = null;
    if (!context.isAdmin) {
      familyId = await getOwnedFamilyId(context.userId);
      if (!familyId) {
        return { credit: 0, debit: 0, pendingCount: 0, pendingAmount: 0, total: 0 };
      }
    }

    const payments = await query<{ amount: number; status: string }>(
      `SELECT amount, status FROM payments
       WHERE (@familyId IS NULL OR family_id = @familyId)`,
      { familyId },
    );

    let debit = 0;
    if (context.isAdmin) {
      const expenses = await query<{ amount: number }>(`SELECT amount FROM expenses`);
      debit = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    }

    const credit = payments
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = payments.filter((p) => p.status === "pending");

    return {
      credit,
      debit,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
      total: payments.length,
    };
  });
