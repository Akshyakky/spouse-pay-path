import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/integrations/auth-middleware";

export type MemberPaymentItem = {
  id: string;
  voucher_no: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  payment_date: string;
  mode: "cash" | "online";
  paid_by: string | null;
};

export type MemberPaymentGroup = {
  memberId: string | null;
  fullName: string;
  relationship: string | null;
  isHead: boolean;
  approved: number;
  pending: number;
  rejected: number;
  paymentCount: number;
  payments: MemberPaymentItem[];
};

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
        familyId: z.string().uuid().optional(),
        paidByMemberId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { query, queryOne } = await import("@/lib/db");
    const { mapPayment } = await import("@/lib/api/mappers");
    const { familyScopeSql, getOwnedFamilyId } = await import("@/lib/api/access");

    const status = data?.status ?? "all";
    const limit = data?.limit ?? 50;
    const offset = data?.offset ?? 0;
    let familyFilter: string | null = data?.familyId ?? null;

    if (!context.isAdmin) {
      familyFilter = await getOwnedFamilyId(context.userId);
      if (!familyFilter) return { items: [], total: 0, limit, offset };
    }

    const familyScope = familyScopeSql(familyFilter);
    const memberSql = data?.paidByMemberId ? " AND paid_by_member_id = @paidByMemberId" : "";
    const memberParams = data?.paidByMemberId ? { paidByMemberId: data.paidByMemberId } : {};

    const count = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM payments
       WHERE (@status = 'all' OR status = @status)${familyScope.sql}${memberSql}`,
      { status, ...familyScope.params, ...memberParams },
    );

    // Oldest pending first so the review queue never hides early submissions.
    const orderBy =
      status === "pending" ? "payment_date ASC, created_at ASC" : "payment_date DESC, created_at DESC";

    const rows = await query(
      `SELECT
          id, voucher_no, family_id, family_due_id, paid_by, paid_by_member_id, mode, amount, payment_date, txn_ref,
          screenshot_url, remarks, status, admin_remarks, approved_by, approved_at,
          created_by, created_at
       FROM payments
       WHERE (@status = 'all' OR status = @status)${familyScope.sql}${memberSql}
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`,
      { limit, offset, status, ...familyScope.params, ...memberParams },
    );
    return {
      items: rows.map(mapPayment),
      total: Number(count?.total ?? 0),
      limit,
      offset,
    };
  });

export const getFamilyMemberPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        familyId: z.string().uuid(),
        from: z.string().min(8).max(20).optional(),
        to: z.string().min(8).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { query } = await import("@/lib/db");
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const { toDateString } = await import("@/lib/db-utils");
    await assertCanAccessFamily(context.userId, context.isAdmin, data.familyId);

    const members = await query<{
      id: string;
      full_name: string;
      relationship: string;
      is_head: boolean;
    }>(
      `SELECT id, full_name, relationship, is_head
       FROM family_members
       WHERE family_id = @familyId
       ORDER BY CASE WHEN is_head THEN 0 ELSE 1 END, full_name`,
      { familyId: data.familyId },
    );

    let dateSql = "";
    const paymentParams: { familyId: string; fromDate?: string; toDate?: string } = {
      familyId: data.familyId,
    };
    if (data.from) {
      dateSql += " AND payment_date >= @fromDate";
      paymentParams.fromDate = data.from;
    }
    if (data.to) {
      dateSql += " AND payment_date <= @toDate";
      paymentParams.toDate = data.to;
    }

    const paymentRows = await query<{
      id: string;
      voucher_no: string;
      amount: number;
      status: MemberPaymentItem["status"];
      payment_date: string;
      mode: MemberPaymentItem["mode"];
      paid_by: string | null;
      paid_by_member_id: string | null;
    }>(
      `SELECT id, voucher_no, amount, status, payment_date, mode, paid_by, paid_by_member_id
       FROM payments
       WHERE family_id = @familyId${dateSql}
       ORDER BY payment_date DESC, created_at DESC`,
      paymentParams,
    );

    const mapItem = (row: (typeof paymentRows)[number]): MemberPaymentItem => ({
      id: String(row.id),
      voucher_no: String(row.voucher_no),
      amount: Number(row.amount),
      status: row.status,
      payment_date: toDateString(row.payment_date) ?? "",
      mode: row.mode,
      paid_by: row.paid_by,
    });

    const byMember = new Map<string, MemberPaymentItem[]>();
    const unassignedItems: MemberPaymentItem[] = [];
    for (const row of paymentRows) {
      const item = mapItem(row);
      const memberId = row.paid_by_member_id ? String(row.paid_by_member_id) : null;
      if (!memberId) {
        unassignedItems.push(item);
        continue;
      }
      const list = byMember.get(memberId) ?? [];
      list.push(item);
      byMember.set(memberId, list);
    }

    const membersOut: MemberPaymentGroup[] = members.map((m) =>
      groupPayments({
        memberId: String(m.id),
        fullName: m.full_name,
        relationship: m.relationship,
        isHead: Boolean(m.is_head),
        payments: byMember.get(String(m.id)) ?? [],
      }),
    );

    membersOut.sort((a, b) => {
      if (a.approved !== b.approved) return b.approved - a.approved;
      if (a.paymentCount !== b.paymentCount) return b.paymentCount - a.paymentCount;
      if (a.isHead !== b.isHead) return a.isHead ? -1 : 1;
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      members: membersOut,
      unassigned:
        unassignedItems.length > 0
          ? groupPayments({
              memberId: null,
              fullName: "Unassigned",
              relationship: null,
              isHead: false,
              payments: unassignedItems,
            })
          : null,
      totals: groupPayments({
        memberId: null,
        fullName: "All members",
        relationship: null,
        isHead: false,
        payments: paymentRows.map(mapItem),
      }),
    };
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
    const payment = mapPayment(row);
    await assertCanAccessFamily(context.userId, context.isAdmin, payment.family_id);
    const family = await queryOne<{
      family_no: string;
      family_name: string;
      contact_phone: string | null;
    }>(`SELECT family_no, family_name, contact_phone FROM families WHERE id = @id`, {
      id: payment.family_id,
    });

    let dueTitle: string | null = null;
    if (payment.family_due_id) {
      const due = await queryOne<{ title: string }>(
        `SELECT pd.title
         FROM family_dues d
         INNER JOIN payment_demands pd ON pd.id = d.demand_id
         WHERE d.id = @id`,
        { id: payment.family_due_id },
      );
      dueTitle = due?.title ? String(due.title) : null;
    }

    return {
      payment,
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
        family_due_id: z
          .union([z.string().uuid(), z.literal(""), z.null()])
          .optional()
          .transform((value) => value || null),
        amount: z.number().positive(),
        mode: z.enum(["cash", "online"]),
        payment_date: z.string().min(8).max(20),
        txn_ref: z.string().trim().max(100).optional().nullable(),
        paid_by: z.string().trim().max(200).optional().nullable(),
        paid_by_member_id: z
          .string({ required_error: "Select which family member paid" })
          .uuid("Select which family member paid"),
        remarks: z.string().trim().max(1000).optional().nullable(),
        screenshot_url: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { withTransaction } = await import("@/lib/db");
    const { assertCanAccessFamily } = await import("@/lib/api/access");

    if (context.isAdmin) throw new Error("Administrators review payments; families submit them");
    await assertCanAccessFamily(context.userId, false, data.family_id);

    if (data.mode === "online" && !data.txn_ref) {
      throw new Error("Transaction reference is required");
    }
    if (data.mode === "online" && !data.screenshot_url) {
      throw new Error("Please attach the payment screenshot");
    }

    const familyDueId = data.family_due_id;

    await withTransaction(async (sql) => {
      if (familyDueId) {
        const due = await sql.queryOne<{
          id: string;
          family_id: string;
          amount_due: number;
          demand_status: string;
        }>(
          `SELECT d.id, d.family_id, d.amount_due, pd.status AS demand_status
           FROM family_dues d
           INNER JOIN payment_demands pd ON pd.id = d.demand_id
           WHERE d.id = @id
           FOR UPDATE OF d`,
          { id: familyDueId },
        );
        if (!due) throw new Error("Due not found");
        if (String(due.family_id) !== data.family_id) throw new Error("Due does not belong to this family");
        if (due.demand_status !== "open") throw new Error("This due is closed");

        const paid = await sql.queryOne<{ approved: number; pending: number }>(
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

      const payer = await resolvePaymentPayer(sql, data.family_id, data.paid_by_member_id);

      await sql.execute(
        `INSERT INTO payments
           (family_id, family_due_id, created_by, status, amount, mode, payment_date, txn_ref, paid_by, paid_by_member_id, remarks, screenshot_url)
         VALUES
           (@familyId, @familyDueId, @createdBy, 'pending', @amount, @mode, @paymentDate, @txnRef, @paidBy, @paidByMemberId, @remarks, @screenshot)`,
        {
          familyId: data.family_id,
          familyDueId,
          createdBy: context.userId,
          amount: data.amount,
          mode: data.mode,
          paymentDate: data.payment_date,
          txnRef: data.txn_ref || null,
          paidBy: payer.paidBy,
          paidByMemberId: payer.paidByMemberId,
          remarks: data.remarks || null,
          screenshot: data.screenshot_url || null,
        },
      );
    });
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
    const { familyScopeSql, getOwnedFamilyId } = await import("@/lib/api/access");

    let familyId: string | null = null;
    if (!context.isAdmin) {
      familyId = await getOwnedFamilyId(context.userId);
      if (!familyId) {
        return { credit: 0, debit: 0, pendingCount: 0, pendingAmount: 0, total: 0 };
      }
    }

    const familyScope = familyScopeSql(familyId);

    const payments = await query<{ amount: number; status: string }>(
      `SELECT amount, status FROM payments
       WHERE 1=1${familyScope.sql}`,
      familyScope.params,
    );

    const expenses = await query<{ amount: number }>(
      `SELECT amount FROM expenses
       WHERE 1=1${familyScope.sql}`,
      familyScope.params,
    );
    const debit = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

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

function groupPayments(input: {
  memberId: string | null;
  fullName: string;
  relationship: string | null;
  isHead: boolean;
  payments: MemberPaymentItem[];
}): MemberPaymentGroup {
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  for (const p of input.payments) {
    if (p.status === "approved") approved += p.amount;
    else if (p.status === "pending") pending += p.amount;
    else if (p.status === "rejected") rejected += p.amount;
  }
  return {
    memberId: input.memberId,
    fullName: input.fullName,
    relationship: input.relationship,
    isHead: input.isHead,
    approved,
    pending,
    rejected,
    paymentCount: input.payments.length,
    payments: input.payments,
  };
}

async function resolvePaymentPayer(
  sql: {
    queryOne: <R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params?: Record<string, unknown>,
    ) => Promise<R | null>;
  },
  familyId: string,
  memberId: string | null | undefined,
) {
  if (!memberId) throw new Error("Select which family member paid");

  const member = await sql.queryOne<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM family_members WHERE id = @id AND family_id = @familyId`,
    { id: memberId, familyId },
  );
  if (!member) throw new Error("Selected family member was not found");
  return { paidByMemberId: String(member.id), paidBy: member.full_name };
}
