import { useQuery } from "@tanstack/react-query";
import { getMyFamily, getMyRole, getSessionUser } from "@/lib/api/auth";
import { uploadFileFn } from "@/lib/api/files";
import {
  FAMILY_EMAIL_DOMAIN,
  calcAge,
  formatMoney,
  loginIdentifierToEmail,
} from "@/lib/auth-utils";

export { FAMILY_EMAIL_DOMAIN, calcAge, formatMoney, loginIdentifierToEmail };
export type { AppRole } from "@/lib/api/auth";

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => getSessionUser(),
  });
}

export function useRole() {
  const { data: user, isLoading: userLoading } = useAuthUser();
  const roleQuery = useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user,
    queryFn: async () => getMyRole(),
  });

  return {
    user: user ?? null,
    role: roleQuery.data,
    isAdmin: roleQuery.data === "admin",
    loading: userLoading || (!!user && roleQuery.isLoading),
  };
}

export function useMyFamily() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: ["my-family", user?.id],
    enabled: !!user,
    queryFn: async () => getMyFamily(),
  });
}

export async function uploadFile(folder: string, file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const base64 = btoa(binary);
  return uploadFileFn({
    data: {
      folder,
      filename: file.name,
      contentType: file.type || undefined,
      base64,
    },
  });
}

export async function getSignedUrl(key: string) {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function useSignedUrl(key: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", key],
    enabled: !!key,
    queryFn: () => getSignedUrl(key!),
    staleTime: Infinity,
  });
}
