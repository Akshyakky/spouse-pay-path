import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mssql/auth-middleware";

export const uploadFileFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        folder: z.string().trim().min(1).max(200),
        filename: z.string().trim().min(1).max(200),
        contentType: z.string().trim().max(120).optional(),
        base64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");

    const root = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads");
    const safeFolder = data.folder.replace(/\.\./g, "").replace(/^\/+/, "").replace(/\\/g, "/");
    const ext = path.extname(data.filename) || ".bin";
    const key = `${safeFolder}/${crypto.randomUUID()}${ext}`.replace(/\\/g, "/");
    const abs = path.join(root, key);
    await mkdir(path.dirname(abs), { recursive: true });
    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.length > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
    await writeFile(abs, buffer);
    return key;
  });
