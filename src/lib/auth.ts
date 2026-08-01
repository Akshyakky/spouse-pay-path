import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FAMILY_EMAIL_DOMAIN = "family.local";

/** Family logins use a username; we derive a deterministic login address from it. */
export function loginIdentifierToEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed.replace(/[^a-z0-9._-]/g, "")}@${FAMILY_EMAIL_DOMAIN}`;
}

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
}

export type AppRole = "admin" | "family";

export function useRole() {
  const { data: user, isLoading: userLoading } = useAuthUser();
  const roleQuery = useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((r) => r.role === "admin") ? "admin" : "family";
    },
  });

  return {
    user: user ?? null,
    role: roleQuery.data,
    isAdmin: roleQuery.data === "admin",
    loading: userLoading || roleQuery.isLoading,
  };
}

export function useMyFamily() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: ["my-family", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("wife_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

const BUCKET = "family-files";

export async function uploadFile(path: string, file: File) {
  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${path}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: false });
  if (error) throw error;
  return key;
}

export async function getSignedUrl(key: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function useSignedUrl(key: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", key],
    enabled: !!key,
    queryFn: () => getSignedUrl(key!),
    staleTime: 30 * 60 * 1000,
  });
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
