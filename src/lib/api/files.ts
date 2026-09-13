import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/auth-middleware";

const FILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".bin": "application/octet-stream",
};

export function isStoredFileId(key: string) {
  return FILE_ID_RE.test(key);
}

export function guessContentType(filename: string, declared?: string) {
  const trimmed = declared?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  const dot = filename.lastIndexOf(".");
  const ext = (dot === -1 ? "" : filename.slice(dot)).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export type StoredFile = {
  id: string;
  original_filename: string;
  content_type: string;
  content: Buffer;
};

function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  throw new Error("Unsupported file content type");
}

export async function getStoredFile(id: string): Promise<StoredFile | null> {
  if (!isStoredFileId(id)) return null;
  const { queryOne } = await import("@/lib/db");
  const row = await queryOne<{
    id: string;
    original_filename: string;
    content_type: string;
    content: unknown;
  }>(
    `SELECT id, original_filename, content_type, content
     FROM stored_files
     WHERE id = @id`,
    { id },
  );
  if (!row) return null;
  return {
    id: String(row.id),
    original_filename: row.original_filename,
    content_type: row.content_type,
    content: toBuffer(row.content),
  };
}

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
  .handler(async ({ data, context }) => {
    const { execute } = await import("@/lib/db");
    const path = await import("node:path");

    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.length > MAX_BYTES) throw new Error("File too large (max 10MB)");
    if (buffer.length === 0) throw new Error("Empty file");

    const safeFolder = data.folder.replace(/\.\./g, "").replace(/^\/+/, "").replace(/\\/g, "/");
    const filename = path.basename(data.filename).replace(/\.\./g, "") || "file.bin";
    const contentType = guessContentType(filename, data.contentType);
    const id = crypto.randomUUID();

    await execute(
      `INSERT INTO stored_files
         (id, folder, original_filename, content_type, content, byte_length, created_by)
       VALUES
         (@id, @folder, @filename, @contentType, @content, @byteLength, @createdBy)`,
      {
        id,
        folder: safeFolder,
        filename,
        contentType,
        content: buffer,
        byteLength: buffer.length,
        createdBy: context.userId,
      },
    );

    return id;
  });
