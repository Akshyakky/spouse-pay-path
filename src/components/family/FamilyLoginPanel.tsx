import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getFamilyLogin, resetFamilyPassword, setFamilyLoginActive } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FamilyLoginPanel({
  familyId,
  loginActive,
}: {
  familyId: string;
  loginActive: boolean;
}) {
  const queryClient = useQueryClient();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const login = useQuery({
    queryKey: ["family-login", familyId],
    queryFn: () => getFamilyLogin({ data: { familyId } }),
  });

  const lock = useMutation({
    mutationFn: async (active: boolean) => setFamilyLoginActive({ data: { familyId, active } }),
    onSuccess: (result) => {
      toast.success(result.active ? "Login unlocked" : "Login locked");
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      await resetFamilyPassword({ data: { familyId, password: newPassword } });
    },
    onSuccess: () => {
      toast.success("Password updated. Existing sessions were signed out.");
      setNewPassword("");
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["family-login", familyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const username = login.data?.username ?? "";
  const currentPassword = login.data?.password ?? null;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loginActive
            ? "This family can sign in with the username and password below."
            : "This login is locked. They cannot sign in until you unlock it."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lock.isPending}
          onClick={() => lock.mutate(!loginActive)}
        >
          {lock.isPending ? "Updating…" : loginActive ? "Lock login" : "Unlock login"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`family-username-${familyId}`}>Username</Label>
          <div className="flex gap-2">
            <Input
              id={`family-username-${familyId}`}
              readOnly
              value={username}
              placeholder={login.isLoading ? "Loading…" : "—"}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!username}
              aria-label="Copy username"
              onClick={() => copyText(username, "Username copied")}
            >
              <Copy />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`family-password-${familyId}`}>Password</Label>
          {currentPassword ? (
            <div className="flex gap-2">
              <Input
                id={`family-password-${familyId}`}
                readOnly
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={showCurrent ? "Hide password" : "Show password"}
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? <EyeOff /> : <Eye />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy password"
                onClick={() => copyText(currentPassword, "Password copied")}
              >
                <Copy />
              </Button>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              {login.isLoading
                ? "Loading…"
                : "This password cannot be shown yet. Set a new password below to store it for viewing."}
            </p>
          )}
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`family-new-password-${familyId}`}>Change password</Label>
          <div className="flex gap-2">
            <Input
              id={`family-new-password-${familyId}`}
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="w-64"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={showNew ? "Hide new password" : "Show new password"}
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </div>
  );
}

function copyText(value: string, success: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(success),
    () => toast.error("Could not copy"),
  );
}
