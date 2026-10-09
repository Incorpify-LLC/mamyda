// Explicit integration smoke; never run against live objects or print credentials.
// VAULT_SMOKE_ENDPOINT must be a private/tunnel endpoint. Credentials come from
// the dedicated VAULT_S3_* values in gitignored deploy/.env.
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as openpgp from "openpgp";

const endpoint = process.env.VAULT_SMOKE_ENDPOINT;
if (!endpoint) throw new Error("Set VAULT_SMOKE_ENDPOINT to the approved private endpoint");
const env = Object.fromEntries(
  readFileSync("deploy/.env", "utf8")
    .split("\n")
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [
        line.slice(0, at),
        line
          .slice(at + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2"),
      ];
    }),
);
if (!env.VAULT_S3_ACCESS_KEY || !env.VAULT_S3_SECRET_KEY)
  throw new Error("Dedicated Vault credentials required");
const client = new S3Client({
  endpoint,
  forcePathStyle: true,
  region: "us-east-1",
  credentials: { accessKeyId: env.VAULT_S3_ACCESS_KEY, secretAccessKey: env.VAULT_S3_SECRET_KEY },
});
const Bucket = "mamyda";
const Key = `assets/${createHash("sha256").update("integration-smoke").digest("hex")}/${randomBytes(16).toString("hex")}/${randomBytes(16).toString("hex")}`;
let uploaded = false;
try {
  const pair = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: "Smoke" }],
    format: "object",
  });
  const original = randomBytes(1024);
  const cipher = await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: original }),
    encryptionKeys: pair.publicKey,
    format: "binary",
  });
  await client.send(
    new PutObjectCommand({ Bucket, Key, Body: cipher, ContentType: "application/octet-stream" }),
  );
  uploaded = true;
  const object = await client.send(new GetObjectCommand({ Bucket, Key }));
  const stored = await object.Body.transformToByteArray();
  if (!Buffer.from(stored).equals(Buffer.from(cipher)))
    throw new Error("Ciphertext storage mismatch");
  const decoded = await openpgp.decrypt({
    message: await openpgp.readMessage({ binaryMessage: stored }),
    decryptionKeys: pair.privateKey,
    format: "binary",
  });
  if (!Buffer.from(decoded.data).equals(original)) throw new Error("Decrypted round-trip mismatch");
  const denied = "forbidden-smoke/" + randomBytes(16).toString("hex");
  try {
    await client.send(new PutObjectCommand({ Bucket, Key: denied, Body: cipher }));
    await client.send(new DeleteObjectCommand({ Bucket, Key: denied }));
    throw new Error("Scoped identity unexpectedly allows writes outside assets prefix");
  } catch (error) {
    if (error.name !== "AccessDenied") throw error;
  }
  console.log("PASS: encrypted MinIO round-trip and restricted-prefix denial");
} finally {
  if (uploaded) {
    await client.send(new DeleteObjectCommand({ Bucket, Key }));
    console.log("Smoke object deleted; versioning retains its encrypted historical version.");
  }
  client.destroy();
}
