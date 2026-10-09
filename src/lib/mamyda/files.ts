import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

function s3(): { client: S3Client; bucket: string } | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION?.trim() || "us-east-1",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export const filesEnabled = createServerFn({ method: "GET" }).handler(async () => Boolean(s3()));

export const listClientFiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((clientId: string) => clientId)
  .handler(async ({ context, data: clientId }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      name: string;
      byte_size: number;
      content_type: string;
      created_at: string;
      project_id: string | null;
    }>`
      select id, name, byte_size, content_type, created_at, project_id from client_files
      where user_id = ${context.userId} and client_id = ${clientId}
      order by created_at desc
    `;
  });

export const deleteClientFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { requireTurnstile } = await import("./turnstile.server");
    await requireTurnstile("file-delete");
    const sql = await getSql();
    const rows = await sql<{ object_key: string }>`
      select object_key from client_files where id = ${id} and user_id = ${context.userId}
    `;
    if (!rows[0]) return;
    const store = s3();
    if (!store) throw new Error("File storage is not configured; file reference retained");
    if (store) {
      await store.client.send(
        new DeleteObjectCommand({ Bucket: store.bucket, Key: rows[0].object_key }),
      );
    }
    await sql`delete from client_files where id = ${id} and user_id = ${context.userId}`;
  });

export async function readOwnedFile(userId: string, id: string) {
  const store = s3();
  if (!store) return null;
  const sql = await getSql();
  const rows = await sql<{ object_key: string; name: string; content_type: string }>`
    select object_key, name, content_type from client_files
    where id = ${id} and user_id = ${userId}
  `;
  if (!rows[0]) return null;
  const object = await store.client.send(
    new GetObjectCommand({ Bucket: store.bucket, Key: rows[0].object_key }),
  );
  if (!object.Body) return null;
  const bytes = await object.Body.transformToByteArray();
  return { name: rows[0].name, contentType: rows[0].content_type, bytes };
}

export async function writeFileObject(key: string, bytes: Uint8Array, contentType: string) {
  const store = s3();
  if (!store) throw new Error("File storage is not configured");
  await store.client.send(
    new PutObjectCommand({
      Bucket: store.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.byteLength,
    }),
    { abortSignal: AbortSignal.timeout(60000) },
  );
}

export const reserveFileBatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    if (!s3()) throw new Error("File storage is not configured");
    const { createFileUploads } = await import("./file-uploads.server");
    const { requireTurnstile } = await import("./turnstile.server");
    return createFileUploads(await getSql(), { put: writeFileObject }, requireTurnstile).reserve(
      context.userId,
      data,
    );
  });

export async function readContentObject(key: string): Promise<string> {
  const store = s3();
  if (!store) throw new Error("File storage is not configured");
  const object = await store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(60000),
  });
  if (!object.Body || !(Symbol.asyncIterator in object.Body))
    throw new Error("Encrypted content unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > 500000) throw new Error("Encrypted content exceeds limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
