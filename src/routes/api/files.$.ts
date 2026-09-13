import { createFileRoute } from "@tanstack/react-router";
import { createReadStream } from "node:fs";
import { access, constants } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/session";
import { getStoredFile, guessContentType, isStoredFileId } from "@/lib/api/files";

function uploadsRoot() {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
}

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

        if (isStoredFileId(key)) {
          const file = await getStoredFile(key);
          if (!file) return new Response("Not found", { status: 404 });
          return new Response(new Uint8Array(file.content), {
            headers: {
              "Content-Type": file.content_type || guessContentType(file.original_filename),
              "Content-Disposition": `inline; filename="${file.original_filename.replace(/"/g, "")}"`,
              "Cache-Control": "private, max-age=3600",
            },
          });
        }

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

        const nodeStream = createReadStream(abs);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new Response(webStream, {
          headers: {
            "Content-Type": guessContentType(abs),
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
