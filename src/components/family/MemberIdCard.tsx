import { useState } from "react";
import { IdCard, Printer } from "lucide-react";
import { PrivateImage } from "@/components/PrivateImage";
import { calcAge, useSignedUrl } from "@/lib/auth";
import { ORG, orgContactLine } from "@/lib/org";
import { relationshipLabel } from "@/lib/relationships";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type IdCardMember = {
  id: string;
  full_name: string;
  relationship: string;
  gender: string | null;
  date_of_birth: string | null;
  blood_group?: string | null;
  contact: string | null;
  address?: string | null;
  photo_url: string | null;
  id_card_type?: string | null;
  id_card_number?: string | null;
};

const ID_CARD_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  epic: "EPIC",
  dl: "DL",
  ration_card: "Ration Card",
};

function idCardTypeLabel(type: string | null | undefined) {
  if (!type) return "ID card";
  return ID_CARD_LABELS[type] ?? type;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCardHtml(opts: {
  member: IdCardMember;
  familyNo: string;
  familyName: string;
  photoUrl?: string | null;
}) {
  const { member, familyNo, familyName, photoUrl } = opts;
  const logoSrc = `${typeof window !== "undefined" ? window.location.origin : ""}${ORG.logoSrc}`;
  const rows: [string, string][] = [
    ["Relationship", relationshipLabel(member.relationship)],
    ["Family ID", familyNo],
    ["Family", familyName],
    ["Gender", member.gender || "—"],
    [idCardTypeLabel(member.id_card_type), member.id_card_number || "—"],
    ["Blood group", member.blood_group || "—"],
    [
      "Date of birth",
      member.date_of_birth ? `${member.date_of_birth} (${calcAge(member.date_of_birth)} yrs)` : "—",
    ],
    ["Contact", member.contact || "—"],
    ["Address", member.address || "—"],
  ];

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>ID card — ${escapeHtml(member.full_name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: "Manrope", system-ui, sans-serif; background: #f6f7f9; color: #0f172a; }
  .card { width: 340px; border-radius: 16px; overflow: hidden; border: 1px solid #d8dde5; background: #fff; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
  .head { background: #0f2f4f; color: #fff; padding: 14px 16px; display: flex; gap: 10px; align-items: center; }
  .head img { width: 36px; height: 36px; border-radius: 6px; background: #fff; object-fit: contain; }
  .head h1 { margin: 0; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; }
  .head p { margin: 4px 0 0; font-size: 11px; opacity: .8; line-height: 1.3; }
  .body { display: flex; gap: 14px; padding: 16px; }
  .photo { width: 84px; height: 100px; border-radius: 10px; object-fit: cover; background: #eef1f5; border: 1px solid #dfe4ec; }
  .name { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
  table { border-collapse: collapse; font-size: 11px; width: 100%; }
  td { padding: 2px 0; vertical-align: top; }
  td.k { color: #64748b; padding-right: 8px; white-space: nowrap; }
  .foot { border-top: 1px dashed #d8dde5; padding: 10px 16px; font-size: 10px; color: #64748b; }
  .foot .row { display: flex; justify-content: space-between; gap: 8px; }
  @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; } }
</style></head>
<body>
  <div class="card">
    <div class="head">
      <img src="${escapeHtml(logoSrc)}" alt="" />
      <div>
        <h1>Family Member ID</h1>
        <p>${escapeHtml(ORG.name)}</p>
      </div>
    </div>
    <div class="body">
      ${photoUrl ? `<img class="photo" src="${escapeHtml(photoUrl)}" alt="" />` : `<div class="photo"></div>`}
      <div style="min-width:0;flex:1">
        <p class="name">${escapeHtml(member.full_name)}</p>
        <table>${rows
          .map(
            ([k, v]) =>
              `<tr><td class="k">${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`,
          )
          .join("")}</table>
      </div>
    </div>
    <div class="foot">
      <div class="row"><span>ID ${escapeHtml(member.id.slice(0, 8).toUpperCase())}</span><span>Issued ${new Date().toLocaleDateString()}</span></div>
      <p style="margin:6px 0 0">${escapeHtml(orgContactLine())}</p>
    </div>
  </div>
  <script>
    (function () {
      var img = document.querySelector("img.photo");
      function go() { window.focus(); window.print(); }
      if (img && !img.complete) { img.onload = go; img.onerror = go; } else { setTimeout(go, 150); }
    })();
  </script>
</body></html>`;
}

export function MemberIdCard({
  member,
  familyNo,
  familyName,
}: {
  member: IdCardMember;
  familyNo: string;
  familyName: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: photoUrl } = useSignedUrl(member.photo_url);

  const print = () => {
    const win = window.open("", "_blank", "width=520,height=680");
    if (!win) return;
    win.document.write(buildCardHtml({ member, familyNo, familyName, photoUrl: photoUrl ?? null }));
    win.document.close();
  };

  const details: [string, string][] = [
    ["Relationship", relationshipLabel(member.relationship)],
    ["Family ID", familyNo],
    ["Family", familyName],
    ["Gender", member.gender || "—"],
    [idCardTypeLabel(member.id_card_type), member.id_card_number || "—"],
    ["Blood group", member.blood_group || "—"],
    [
      "Date of birth",
      member.date_of_birth ? `${member.date_of_birth} (${calcAge(member.date_of_birth)} yrs)` : "—",
    ],
    ["Contact", member.contact || "—"],
    ["Address", member.address || "—"],
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IdCard className="mr-2 size-3.5" /> ID card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Member ID card</DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 bg-primary px-4 py-3 text-primary-foreground">
            <img
              src={ORG.logoSrc}
              alt={ORG.name}
              className="size-9 shrink-0 rounded-md bg-white object-contain"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Family Member ID</p>
              <p className="mt-1 text-[11px] leading-snug break-words opacity-80">{ORG.name}</p>
            </div>
          </div>
          <div className="flex gap-4 p-4">
            <PrivateImage
              path={member.photo_url}
              alt={member.full_name}
              className="h-[100px] w-[84px] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{member.full_name}</p>
              <dl className="mt-2 space-y-1 text-xs">
                {details.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="truncate capitalize">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="border-t border-dashed border-border px-4 py-2 text-[10px] text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>ID {member.id.slice(0, 8).toUpperCase()}</span>
              <span>Issued {new Date().toLocaleDateString()}</span>
            </div>
            <p className="mt-1">{orgContactLine()}</p>
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button onClick={print}>
            <Printer className="mr-2 size-4" /> Print / Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
