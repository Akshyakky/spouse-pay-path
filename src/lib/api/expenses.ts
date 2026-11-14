import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/integrations/auth-middleware";

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { query } = await import("@/lib/db");
    const { mapExpense } = await import("@/lib/api/mappers");
    const rows = await query(
      `SELECT e.id, e.category, e.amount, e.expense_date, e.description, e.attachment_url,
              e.family_id, e.created_by, e.created_at,
              f.family_no, f.family_name,
              COALESCE(NULLIF(p.full_name, ''), p.username, u.email) AS created_by_name
       FROM expenses e
       LEFT JOIN families f ON f.id = e.family_id
       LEFT JOIN profiles p ON p.id = e.created_by
       LEFT JOIN users u ON u.id = e.created_by
       ORDER BY e.expense_date DESC, e.created_at DESC`,
    );
    return rows.map(mapExpense);
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        amount: z.number().positive(),
        category: z.string().trim().min(1).max(100),
        description: z.string().trim().max(1000).optional().nullable(),
        expense_date: z.string().min(8).max(20),
        attachment_url: z.string().trim().max(1000).optional().nullable(),
        family_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { execute, queryOne } = await import("@/lib/db");
    const familyId = data.family_id || null;
    if (familyId) {
      const family = await queryOne<{ id: string }>(`SELECT id FROM families WHERE id = @id`, {
        id: familyId,
      });
      if (!family) throw new Error("Family not found");
    }
    await execute(
      `INSERT INTO expenses
         (amount, category, description, expense_date, attachment_url, family_id, created_by)
       VALUES
         (@amount, @category, @description, @expenseDate, @attachment, @familyId, @createdBy)`,
      {
        amount: data.amount,
        category: data.category,
        description: data.description || null,
        expenseDate: data.expense_date,
        attachment: data.attachment_url || null,
        familyId,
        createdBy: context.userId,
      },
    );
    return { ok: true };
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string().min(8).max(20),
        to: z.string().min(8).max(20),
        familyId: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { query } = await import("@/lib/db");
    const { mapExpense } = await import("@/lib/api/mappers");
    const { toDateString } = await import("@/lib/db-utils");
    const { familyScopeSql, getOwnedFamilyId } = await import("@/lib/api/access");

    let familyId: string | null = null;
    if (!context.isAdmin) {
      familyId = await getOwnedFamilyId(context.userId);
      if (!familyId) return { payments: [], expenses: [] };
    } else {
      familyId = data.familyId ?? null;
    }

    const familyScope = familyScopeSql(familyId);
    const expenseScope = familyScopeSql(familyId, "e.family_id");

    const payments = await query(
      `SELECT id, voucher_no, amount, status, payment_date, mode
       FROM payments
       WHERE payment_date >= @fromDate AND payment_date <= @toDate${familyScope.sql}
       ORDER BY payment_date DESC`,
      { fromDate: data.from, toDate: data.to, ...familyScope.params },
    );

    const rows = await query(
      `SELECT e.id, e.amount, e.category, e.expense_date, e.description, e.attachment_url,
              e.family_id, e.created_by, e.created_at, f.family_no, f.family_name
       FROM expenses e
       LEFT JOIN families f ON f.id = e.family_id
       WHERE e.expense_date >= @fromDate AND e.expense_date <= @toDate${expenseScope.sql}
       ORDER BY e.expense_date DESC`,
      { fromDate: data.from, toDate: data.to, ...expenseScope.params },
    );
    const expenses = rows.map(mapExpense);

    return {
      payments: payments.map((p) => ({
        id: String(p.id),
        voucher_no: String(p.voucher_no),
        amount: Number(p.amount),
        status: String(p.status),
        payment_date: toDateString(p.payment_date) ?? "",
        mode: String(p.mode),
      })),
      expenses,
    };
  });
