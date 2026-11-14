import { ORG } from "@/lib/org";
import { cn } from "@/lib/utils";

export function OrgMark({
  className,
  compact = false,
  showProduct = true,
}: {
  className?: string;
  compact?: boolean;
  showProduct?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <img
        src={ORG.logoSrc}
        alt={ORG.name}
        className={cn(
          "shrink-0 rounded-md bg-white object-contain",
          compact ? "size-8" : "size-11",
        )}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display font-semibold leading-snug",
            compact ? "text-xs" : "text-sm",
            "break-words",
          )}
        >
          {ORG.name}
        </span>
        {showProduct && !compact ? (
          <span className="mt-0.5 block text-[11px] opacity-70">{ORG.product}</span>
        ) : null}
      </span>
    </span>
  );
}

export function OrgLetterhead({ className }: { className?: string }) {
  return (
    <header className={cn("flex items-start gap-3", className)}>
      <img
        src={ORG.logoSrc}
        alt={ORG.name}
        className="size-14 shrink-0 rounded-md bg-white object-contain"
      />
      <div className="min-w-0">
        <p className="font-display text-base font-semibold leading-snug break-words">{ORG.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{ORG.product}</p>
        <OrgContactText className="mt-1 text-sm" />
      </div>
    </header>
  );
}

export function OrgContactText({
  className,
  prefix,
}: {
  className?: string;
  prefix?: string;
}) {
  return (
    <p className={className}>
      {prefix ? `${prefix} ` : null}
      {ORG.contactPerson} ·{" "}
      <a href={ORG.phoneHref} className="underline-offset-2 hover:underline">
        {ORG.phone}
      </a>
    </p>
  );
}
