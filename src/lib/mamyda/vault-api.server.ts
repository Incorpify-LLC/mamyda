import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/verify.server";
import { requireTurnstile } from "./turnstile.server";
import { createVaultWorkflow, type VaultStore } from "./vault-workflow.server";

let cachedStore: { signature: string; client: S3Client; store: VaultStore } | undefined;

export function vaultStore() {
  const endpoint = process.env.VAULT_S3_ENDPOINT?.trim();
  const accessKeyId = process.env.VAULT_S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.VAULT_S3_SECRET_KEY?.trim();
  const bucket = process.env.VAULT_S3_BUCKET?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || bucket !== "mamyda")
    throw new Error("Vault storage is not configured");
  const region = process.env.VAULT_S3_REGION?.trim() || "us-east-1";
  const signature = JSON.stringify([endpoint, region, bucket, accessKeyId, secretAccessKey]);
  if (cachedStore?.signature === signature) return cachedStore.store;
  cachedStore?.client.destroy();
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const store: VaultStore = {
    bucket,
    async put(key: string, bytes: Uint8Array) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: "application/octet-stream",
          ContentLength: bytes.byteLength,
        }),
        { abortSignal: AbortSignal.timeout(60_000) },
      );
    },
    async get(key: string) {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(60_000),
      });
      if (!object.Body || !(Symbol.asyncIterator in object.Body))
        throw new Error("Vault object unavailable");
      return object.Body as AsyncIterable<Uint8Array>;
    },
    async remove(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(60_000),
      });
    },
  };
  cachedStore = { signature, client, store };
  return store;
}

export async function vaultWorkflow() {
  return createVaultWorkflow(await getSql(), vaultStore(), requireTurnstile);
}

/** Cookie-authenticated upload mutations are same-origin, never cross-site form submissions. */
export function assertVaultOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.BETTER_AUTH_URL?.trim() || request.url).origin;
  if (origin !== expected) throw new Error("Invalid upload origin");
}

export async function* vaultRequestBody(request: Request): AsyncGenerator<Uint8Array> {
  if (!request.body) throw new Error("Missing encrypted body");
  const reader = request.body.getReader();
  const signal = AbortSignal.timeout(60_000);
  const cancel = () => {
    void reader.cancel("Upload timed out").catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      const result = await reader.read();
      if (signal.aborted) throw new Error("Upload timed out");
      if (result.done) break;
      yield result.value;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Isolated adapters keep route error responses generic and testable. */
export async function uploadVaultRequest(request: Request, uploadId: string) {
  const owner = await requireUserId();
  assertVaultOrigin(request);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/octet-stream")
    throw new Error("Encrypted binary body required");
  // Reservation creation performed Siteverify. Do not replay its single-use token:
  // this step requires the same owner, short-lived reservation and bounded bytes.
  await (await vaultWorkflow()).upload(owner, uploadId, vaultRequestBody(request));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export async function readVaultRequest(assetId: string) {
  const owner = await requireUserId();
  const bytes = await (await vaultWorkflow()).read(owner, assetId);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
