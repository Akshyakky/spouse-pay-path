import { queryOne } from "@/lib/db";

export async function assertCanAccessFamily(userId: string, isAdmin: boolean, familyId: string) {
  if (isAdmin) return;
  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM dbo.families WHERE id = @familyId AND wife_user_id = @userId`,
    { familyId, userId },
  );
  if (!owned) throw new Error("Forbidden");
}

export async function getOwnedFamilyId(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM dbo.families WHERE wife_user_id = @userId`,
    { userId },
  );
  return row ? String(row.id) : null;
}
