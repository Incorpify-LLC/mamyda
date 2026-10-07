import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024;

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

function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop()?.replace(/[^\w.\- ()]+/g, "_").slice(0, 120);
  return base || "file";
}

function allowedType(type: string): boolean {
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    type === "text/plain" ||
    type === "application/zip" ||
    type.startsWith("application/vnd.openxmlformats-officedocument.")
  );
}

export const filesEnabled = createServerFn({ method: "GET" }).handler(async () => Boolean(s3()));

export const listClientFiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((clientId: string) => clientId)
  .handler(async ({ context, data: clientId }) => {
    const sql = await getSql();
    return sql<{ id: string; name: string; byte_size: number; content_type: string }>`
      select id, name, byte_size, content_type from client_files
      where user_id = ${context.userId} and client_id = ${clientId}
      order by created_at desc
    `;
  });

export const uploadClientFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { clientId: string; name: string; contentType: string; base64: string }) => input)
  .handler(async ({ context, data }) => {
    const store = s3();
    if (!store) throw new Error("File storage is not configured");
    if (!allowedType(data.contentType)) throw new Error("That file type is not allowed");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("File must be under 8 MB");
    const sql = await getSql();
    const owned = await sql`select id from clients where id = ${data.clientId} and user_id = ${context.userId}`;
    if (!owned[0]) throw new Error("Unknown client");
    const id = nid();
    const key = `${context.userId}/${data.clientId}/${id}/${safeName(data.name)}`;
    await store.client.send(new PutObjectCommand({
      Bucket: store.bucket,
      Key: key,
      Body: bytes,
      ContentType: data.contentType,
    }));
    await sql`
      insert into client_files (id, user_id, client_id, name, content_type, byte_size, object_key)
      values (${id}, ${context.userId}, ${data.clientId}, ${safeName(data.name)}, ${data.contentType}, ${bytes.length}, ${key})
    `;
    return { id };
  });

export const deleteClientFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ object_key: string }>`
      select object_key from client_files where id = ${id} and user_id = ${context.userId}
    `;
    if (!rows[0]) return;
    const store = s3();
    if (store) {
      await store.client.send(new DeleteObjectCommand({ Bucket: store.bucket, Key: rows[0].object_key }));
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
  const object = await store.client.send(new GetObjectCommand({ Bucket: store.bucket, Key: rows[0].object_key }));
  if (!object.Body) return null;
  const bytes = await object.Body.transformToByteArray();
  return { name: rows[0].name, contentType: rows[0].content_type, bytes };
}
