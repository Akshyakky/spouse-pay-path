import { queryOne } from "@/lib/db";

export async function assertCanAccessFamily(userId: string, isAdmin: boolean, familyId: string) {
  if (isAdmin) return;
  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM families WHERE id = @familyId AND wife_user_id = @userId`,
    { familyId, userId },
  );
  if (!owned) throw new Error("Forbidden");
}

export async function getOwnedFamilyId(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM families WHERE wife_user_id = @userId`,
    { userId },
  );
  return row ? String(row.id) : null;
}

/** Family filter without `($1 IS NULL OR col = $1)`, which Postgres rejects when $1 is null. */
export function familyScopeSql(familyId: string | null, column = "family_id") {
  if (!familyId) return { sql: "", params: {} as { familyId?: string } };
  return { sql: ` AND ${column} = @familyId`, params: { familyId } };
}
