import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/integrations/mssql/auth-middleware";
import { toDateString } from "@/lib/db-utils";

export type FamilyDueRow = {
  id: string;
  demand_id: string;
  family_id: string;
  amount_due: number;
  title: string;
  description: string | null;
  due_date: string | null;
  demand_status: "open" | "closed";
  family_no: string | null;
  family_name: string | null;
  paid_approved: number;
  paid_pending: number;
  remaining: number;
  payable: number;
};

function mapFamilyDue(row: Record<string, unknown>): FamilyDueRow {
  const amountDue = Number(row.amount_due);
  const paidApproved = Number(row.paid_approved ?? 0);
  const paidPending = Number(row.paid_pending ?? 0);
  const remaining = Math.max(0, amountDue - paidApproved);
  const payable = Math.max(0, amountDue - paidApproved - paidPending);
  return {
    id: String(row.id),
    demand_id: String(row.demand_id),
    family_id: String(row.family_id),
    amount_due: amountDue,
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    due_date: toDateString(row.due_date),
    demand_status: row.demand_status as "open" | "closed",
    family_no: (row.family_no as string | null) ?? null,
    family_name: (row.family_name as string | null) ?? null,
    paid_approved: paidApproved,
    paid_pending: paidPending,
    remaining,
    payable,
  };
}

const dueSelect = `
  SELECT
    d.id, d.demand_id, d.family_id, d.amount_due,
    pd.title, pd.description, pd.due_date, pd.status AS demand_status,
    f.family_no, f.family_name,
    ISNULL((
      SELECT SUM(p.amount) FROM dbo.payments p
      WHERE p.family_due_id = d.id AND p.status = N'approved'
    ), 0) AS paid_approved,
    ISNULL((
      SELECT SUM(p.amount) FROM dbo.payments p
      WHERE p.family_due_id = d.id AND p.status = N'pending'
    ), 0) AS paid_pending
  FROM dbo.family_dues d
  INNER JOIN dbo.payment_demands pd ON pd.id = d.demand_id
  INNER JOIN dbo.families f ON f.id = d.family_id
`;

export const listDemands = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("@/lib/db");
    const { getOwnedFamilyId } = await import("@/lib/api/access");

    if (context.isAdmin) {
      const rows = await query(
        `SELECT
            pd.id, pd.title, pd.description, pd.amount_per_family, pd.due_date, pd.status, pd.created_at,
            (SELECT COUNT(*) FROM dbo.family_dues d WHERE d.demand_id = pd.id) AS family_count,
            ISNULL((
              SELECT SUM(p.amount)
              FROM dbo.payments p
              INNER JOIN dbo.family_dues d ON d.id = p.family_due_id
              WHERE d.demand_id = pd.id AND p.status = N'approved'
            ), 0) AS collected,
            ISNULL((
              SELECT SUM(d.amount_due) FROM dbo.family_dues d WHERE d.demand_id = pd.id
            ), 0) AS total_due
         FROM dbo.payment_demands pd
         ORDER BY pd.created_at DESC`,
      );
      return rows.map((row) => {
        const totalDue = Number(row.total_due ?? 0);
        const collected = Number(row.collected ?? 0);
        return {
          id: String(row.id),
          title: String(row.title),
          description: (row.description as string | null) ?? null,
          amount_per_family: Number(row.amount_per_family),
          due_date: toDateString(row.due_date),
          status: row.status as "open" | "closed",
          created_at: row.created_at ? String(row.created_at) : "",
          family_count: Number(row.family_count ?? 0),
          collected,
          total_due: totalDue,
          outstanding: Math.max(0, totalDue - collected),
        };
      });
    }

    const familyId = await getOwnedFamilyId(context.userId);
    if (!familyId) return [];

    const rows = await query(
      `${dueSelect}
       WHERE d.family_id = @familyId
       ORDER BY CASE WHEN pd.status = N'open' THEN 0 ELSE 1 END, pd.created_at DESC`,
      { familyId },
    );
    return rows.map(mapFamilyDue);
  });

export const listDemandFamilies = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) => z.object({ demandId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { query } = await import("@/lib/db");
    const rows = await query(
      `${dueSelect}
       WHERE d.demand_id = @demandId
       ORDER BY f.family_no`,
      { demandId: data.demandId },
    );
    return rows.map(mapFamilyDue);
  });

export const createDemand = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(1000).optional().nullable(),
        amount_per_family: z.number().positive(),
        due_date: z.string().trim().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { queryOne, execute, query } = await import("@/lib/db");

    const families = await query<{ id: string }>(`SELECT id FROM dbo.families ORDER BY family_no`);
    if (families.length === 0) throw new Error("Create at least one family before raising a due");

    const demand = await queryOne<{ id: string }>(
      `DECLARE @out TABLE (id UNIQUEIDENTIFIER);
       INSERT INTO dbo.payment_demands (title, description, amount_per_family, due_date, created_by)
       OUTPUT INSERTED.id INTO @out
       VALUES (@title, @description, @amount, @dueDate, @createdBy);
       SELECT id FROM @out;`,
      {
        title: data.title,
        description: data.description || null,
        amount: data.amount_per_family,
        dueDate: data.due_date || null,
        createdBy: context.userId,
      },
    );
    if (!demand?.id) throw new Error("Could not create payment demand");

    for (const family of families) {
      await execute(
        `INSERT INTO dbo.family_dues (demand_id, family_id, amount_due)
         VALUES (@demandId, @familyId, @amount)`,
        {
          demandId: demand.id,
          familyId: family.id,
          amount: data.amount_per_family,
        },
      );
    }

    return { id: String(demand.id), familyCount: families.length };
  });

export const setDemandStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "closed"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { execute } = await import("@/lib/db");
    await execute(`UPDATE dbo.payment_demands SET status = @status WHERE id = @id`, {
      id: data.id,
      status: data.status,
    });
    return { ok: true };
  });

export const getFamilyDueById = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { queryOne } = await import("@/lib/db");
    const { assertCanAccessFamily } = await import("@/lib/api/access");
    const row = await queryOne(`${dueSelect} WHERE d.id = @id`, { id: data.id });
    if (!row) throw new Error("Due not found");
    await assertCanAccessFamily(context.userId, context.isAdmin, String(row.family_id));
    return mapFamilyDue(row);
  });
