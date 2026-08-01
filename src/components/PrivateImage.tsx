import { useSignedUrl } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

export function PrivateImage({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const { data: url } = useSignedUrl(path);
  if (!path || !url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="size-5" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={cn("rounded-lg object-cover", className)} />;
}

export function PrivateFileLink({
  path,
  label = "View attachment",
}: {
  path: string | null | undefined;
  label?: string;
}) {
  const { data: url } = useSignedUrl(path);
  if (!path) return <span className="text-xs text-muted-foreground">—</span>;
  if (!url) return <span className="text-xs text-muted-foreground">Loading…</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-medium text-accent underline underline-offset-2"
    >
      {label}
    </a>
  );
}
