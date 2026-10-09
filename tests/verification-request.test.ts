import { describe, expect, it } from "vitest";
import { VerificationRequest } from "@/lib/verification-request";
describe("submission verification", () => {
  it("waits for verification and consumes a token once", async () => {
    const request = new VerificationRequest(() => {});
    const promise = request.start("owner", "task-manage", "Saving task");
    const id = request.current!.id;
    expect(request.accept(id, "")).toBe(false);
    expect(request.accept(id, "fresh-token")).toBe(true);
    expect(request.accept(id, "duplicate-token")).toBe(false);
    await expect(promise).resolves.toBe("fresh-token");
    expect(request.current).toBeNull();
  });
  it("rejects competing requests without replacing the original", async () => {
    const request = new VerificationRequest(() => {});
    const original = request.start("one", "note-save", "Saving note");
    await expect(request.start("two", "llm-settings", "Saving settings")).rejects.toThrow(
      "already",
    );
    request.cancel("one");
    await expect(original).rejects.toThrow("cancelled");
  });
  it("ignores callbacks after cancel/navigation and never accepts them for a new request", async () => {
    const request = new VerificationRequest(() => {});
    const old = request.start("one", "task-manage", "Saving task");
    const oldId = request.current!.id;
    request.cancel("another-owner");
    expect(request.current!.id).toBe(oldId);
    request.cancel("one");
    await expect(old).rejects.toThrow("cancelled");
    const next = request.start("two", "note-save", "Saving note");
    expect(request.accept(oldId, "stale")).toBe(false);
    request.accept(request.current!.id, "new");
    await expect(next).resolves.toBe("new");
  });
});
