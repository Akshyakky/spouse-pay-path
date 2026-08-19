/** Shared client-safe helpers (no server imports). */

export const FAMILY_EMAIL_DOMAIN = "family.local";

/** Family logins use a username; we derive a deterministic login address from it. */
export function loginIdentifierToEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed.replace(/[^a-z0-9._-]/g, "")}@${FAMILY_EMAIL_DOMAIN}`;
}

export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcAge(dob: string | null | undefined) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
