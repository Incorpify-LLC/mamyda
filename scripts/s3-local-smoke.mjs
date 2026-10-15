// Disposable local MinIO only. No deployed storage credentials or customer objects.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as openpgp from "openpgp";
const endpoint = new URL(process.env.S3_QA_ENDPOINT ?? "http://127.0.0.1:19022");
if (!["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
  throw new Error("Local smoke refuses non-loopback storage");
const client = new S3Client({
  endpoint: endpoint.href,
  forcePathStyle: true,
  region: "us-east-1",
  credentials: { accessKeyId: "fixture-admin", secretAccessKey: "fixture-only-secret" },
});
const Bucket = `mamyda-sdk-qa-${randomBytes(8).toString("hex")}`;
const Key = "assets/fixture/object";
let created = false,
  uploaded = false;
try {
  await client.send(new CreateBucketCommand({ Bucket }));
  created = true;
  const original = randomBytes(1024);
  const pair = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: "Local fixture" }],
    format: "object",
  });
  const cipher = await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: original }),
    encryptionKeys: pair.publicKey,
    format: "binary",
  });
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key,
      Body: cipher,
      ContentLength: cipher.byteLength,
      ContentType: "application/octet-stream",
    }),
  );
  uploaded = true;
  const object = await client.send(new GetObjectCommand({ Bucket, Key }));
  const stored = await object.Body.transformToByteArray();
  assert.deepEqual(Buffer.from(stored), Buffer.from(cipher));
  const decoded = await openpgp.decrypt({
    message: await openpgp.readMessage({ binaryMessage: stored }),
    decryptionKeys: pair.privateKey,
    format: "binary",
  });
  assert.deepEqual(Buffer.from(decoded.data), original);
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
  uploaded = false;
  await assert.rejects(client.send(new GetObjectCommand({ Bucket, Key })), { name: "NoSuchKey" });
  console.log(
    "PASS: real disposable MinIO, SDK checksums/signing, encrypted binary round trip and XML NoSuchKey response.",
  );
} finally {
  if (uploaded) await client.send(new DeleteObjectCommand({ Bucket, Key }));
  if (created) await client.send(new DeleteBucketCommand({ Bucket }));
  client.destroy();
}
