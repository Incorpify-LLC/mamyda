import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createServer, type IncomingMessage } from "node:http";
import { vaultStore } from "@/lib/mamyda/vault-api.server";
import { readOwnedFile, writeFileObject } from "@/lib/mamyda/files";

vi.mock("@/lib/auth/middleware", () => ({ authMiddleware: {} }));
vi.mock("@/lib/auth/verify.server", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getSql: async () => async () => [
    {
      object_key: "clients/fixture/file",
      name: "Fixture",
      content_type: "application/octet-stream",
    },
  ],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, validator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
const objects = new Map<string, Buffer>();
const requests: Array<{ method: string; path: string; signed: boolean }> = [];
async function bytes(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
// HTTP rather than a mocked SDK: exercises its signing, checksums, XML error
// parser and binary body handling. Never contacts a real bucket or credentials.
const server = createServer(async (request, response) => {
  const path = request.url!.split("?")[0];
  requests.push({
    method: request.method!,
    path,
    signed: request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ") ?? false,
  });
  if (path.includes("forbidden")) {
    response.writeHead(403, { "content-type": "application/xml" });
    response.end(
      "<Error><Code>AccessDenied</Code><Message>Fixture permission denied</Message><RequestId>fixture</RequestId></Error>",
    );
  } else if (request.method === "PUT") {
    objects.set(path, await bytes(request));
    response.writeHead(200, { ETag: '"fixture-etag"' });
    response.end();
  } else if (request.method === "GET" && objects.has(path)) {
    const body = objects.get(path)!;
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": body.length,
    });
    response.end(body);
  } else if (request.method === "DELETE") {
    objects.delete(path);
    response.writeHead(204);
    response.end();
  } else {
    response.writeHead(404);
    response.end();
  }
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  for (const prefix of ["S3", "VAULT_S3"]) {
    vi.stubEnv(`${prefix}_ENDPOINT`, `http://127.0.0.1:${address.port}`);
    vi.stubEnv(`${prefix}_ACCESS_KEY`, "fixture-access");
    vi.stubEnv(`${prefix}_SECRET_KEY`, "fixture-secret");
    vi.stubEnv(`${prefix}_BUCKET`, "mamyda");
    vi.stubEnv(`${prefix}_REGION`, "us-east-1");
  }
});
afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
test("upgraded SDK preserves signed path-style binary file and Vault round trips", async () => {
  const original = new Uint8Array([0, 255, 128, 1, 0, 42]);
  const store = vaultStore();
  await store.put("assets/fixture/object", original);
  const chunks: Uint8Array[] = [];
  for await (const chunk of await store.get("assets/fixture/object")) chunks.push(chunk);
  expect(Buffer.concat(chunks)).toEqual(Buffer.from(original));
  await store.remove("assets/fixture/object");
  expect(objects.has("/mamyda/assets/fixture/object")).toBe(false);
  await writeFileObject("clients/fixture/file", original, "application/octet-stream");
  expect((await readOwnedFile("fixture", "file"))?.bytes).toEqual(original);
  expect(requests.every((request) => request.signed)).toBe(true);
  expect(requests.every((request) => request.path.startsWith("/mamyda/"))).toBe(true);
});
test("upgraded XML parser preserves provider error codes for retry and authorization handling", async () => {
  await expect(vaultStore().get("assets/forbidden")).rejects.toMatchObject({
    name: "AccessDenied",
    message: "Fixture permission denied",
    $metadata: { httpStatusCode: 403 },
  });
});
