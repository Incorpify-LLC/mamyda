import { afterEach, beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({
  owner: "alice",
  unauthorized: false,
  upload: vi.fn(),
  read: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/auth/verify.server", () => ({
  requireUserId: async () => {
    if (state.unauthorized) throw new Error("Unauthorized");
    return state.owner;
  },
}));
vi.mock("@/lib/db", () => ({ getSql: async () => state.sql }));
vi.mock("@/lib/mamyda/turnstile.server", () => ({ requireTurnstile: vi.fn() }));
vi.mock("@/lib/mamyda/vault-workflow.server", () => ({
  createVaultWorkflow: () => ({ upload: state.upload, read: state.read }),
}));
import { uploadVaultRequest, readVaultRequest, vaultStore } from "@/lib/mamyda/vault-api.server";

beforeEach(() => {
  vi.clearAllMocks();
  state.unauthorized = false;
  vi.stubEnv("BETTER_AUTH_URL", "https://mamyda.example");
  vi.stubEnv("VAULT_S3_ENDPOINT", "http://127.0.0.1:9000");
  vi.stubEnv("VAULT_S3_BUCKET", "mamyda");
  vi.stubEnv("VAULT_S3_ACCESS_KEY", "test");
  vi.stubEnv("VAULT_S3_SECRET_KEY", "test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
function request(origin = "https://mamyda.example", type = "application/octet-stream") {
  return new Request("https://mamyda.example/api/vault/uploads/test", {
    method: "PUT",
    headers: { origin, "content-type": type },
    body: new Uint8Array([1, 2, 3]),
  });
}
test("request adapter resolves session owner and consumes raw bytes without base64", async () => {
  state.upload.mockImplementationOnce(async (owner, uploadId, body) => {
    expect(owner).toBe("alice");
    expect(uploadId).toBe("test");
    const chunks = [];
    for await (const value of body) chunks.push(...value);
    expect(chunks).toEqual([1, 2, 3]);
  });
  expect((await uploadVaultRequest(request(), "test")).status).toBe(204);
});
test("signed-out, cross-origin and nonbinary requests never reach the upload workflow", async () => {
  state.unauthorized = true;
  await expect(uploadVaultRequest(request(), "test")).rejects.toThrow("Unauthorized");
  state.unauthorized = false;
  await expect(uploadVaultRequest(request("https://attacker.example"), "test")).rejects.toThrow(
    /origin/,
  );
  await expect(
    uploadVaultRequest(request("https://mamyda.example", "text/plain"), "test"),
  ).rejects.toThrow(/binary/);
  expect(state.upload).not.toHaveBeenCalled();
});
test("download adapter returns only owner-checked ciphertext with no cache/sniffing", async () => {
  state.read.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
  const response = await readVaultRequest("asset");
  expect(state.read).toHaveBeenCalledWith("alice", "asset");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  state.unauthorized = true;
  await expect(readVaultRequest("asset")).rejects.toThrow("Unauthorized");
  expect(state.read).toHaveBeenCalledTimes(1);
});
test("missing endpoint or wrong bucket fails closed rather than falling back to legacy credentials", () => {
  vi.stubEnv("VAULT_S3_ENDPOINT", "");
  expect(() => vaultStore()).toThrow(/configured/);
  vi.stubEnv("VAULT_S3_ENDPOINT", "http://localhost:9000");
  vi.stubEnv("VAULT_S3_BUCKET", "other");
  expect(() => vaultStore()).toThrow(/configured/);
});

test("configured storage clients are reused across requests", () => {
  expect(vaultStore()).toBe(vaultStore());
});
