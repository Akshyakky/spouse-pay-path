import { createFileRoute } from "@tanstack/react-router";
import { createReadStream } from "node:fs";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/session";

function uploadsRoot() {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".bin": "application/octet-stream",
};

export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await getSessionUser();
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = String((params as { _splat?: string })._splat ?? "")
          .replace(/\.\./g, "")
          .replace(/^\/+/, "")
          .replace(/\\/g, "/");

        if (!key) return new Response("Not found", { status: 404 });

        const abs = path.join(uploadsRoot(), key);
        const root = uploadsRoot();
        if (!abs.startsWith(root)) {
          return new Response("Forbidden", { status: 403 });
        }

        try {
          await access(abs, constants.R_OK);
        } catch {
          return new Response("Not found", { status: 404 });
        }

        const ext = path.extname(abs).toLowerCase();
        const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
        const nodeStream = createReadStream(abs);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new Response(webStream, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
