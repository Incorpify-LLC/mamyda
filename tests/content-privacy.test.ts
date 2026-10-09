import { expect, test } from "vitest";
import { assertContentWrite, RECOVERY_WARNING } from "@/lib/content-privacy";
import { noteInput, taskInput } from "@/lib/mamyda/validation";
test("encrypted saves never carry readable content, and stale editors cannot overwrite it", () => {
  expect(() => assertContentWrite("secret", true, false)).toThrow();
  expect(() => assertContentWrite("secret", false, true)).toThrow();
  expect(() => assertContentWrite(undefined, false, true)).not.toThrow();
  expect(() => assertContentWrite("", true, true)).not.toThrow();
});
test("encrypted notes require explicit visible metadata rather than deriving it from ciphertext", () => {
  const encryption = { ciphertext: "cipher", fingerprint: "a".repeat(40) };
  expect(noteInput.safeParse({ body: "", encryption }).success).toBe(false);
  expect(
    noteInput.safeParse({ body: "", title: "Visible", tags: ["tag"], encryption }).success,
  ).toBe(true);
  expect(taskInput.parse({ projectId: "p", title: "Visible", encryption }).encryption).toEqual(
    encryption,
  );
});
test("the recovery warning explicitly states that forgotten passphrases cannot be reset", () => {
  expect(RECOVERY_WARNING).toContain("cannot reset");
  expect(RECOVERY_WARNING).toContain("recover");
});
