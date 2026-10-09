import { afterEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ token: "fresh" }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://mamyda.incorpify.in", {
      headers: { "x-turnstile-response": request.token },
    }),
}));
import { requireTurnstile } from "@/lib/mamyda/turnstile.server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  request.token = "fresh";
});
describe("submission Siteverify contract", () => {
  function setup(result: unknown) {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "fixture-server-secret");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "mamyda.incorpify.in");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  it("rejects a missing token before sending a verification request", async () => {
    const fetch = setup({});
    request.token = "";
    await expect(requireTurnstile("minute-save")).rejects.toThrow("security check");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { success: false, action: "minute-save", hostname: "mamyda.incorpify.in" },
    { success: true, action: "note-save", hostname: "mamyda.incorpify.in" },
    { success: true, action: "minute-save", hostname: "foreign.example" },
  ])("rejects failed, expired/reused or mismatched tokens", async (result) => {
    setup(result);
    await expect(requireTurnstile("minute-save")).rejects.toThrow("did not match");
  });
  it("accepts only server-verified success for the expected action and hostname", async () => {
    const fetch = setup({ success: true, action: "minute-save", hostname: "mamyda.incorpify.in" });
    await requireTurnstile("minute-save");
    expect(fetch.mock.calls[0][0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(fetch.mock.calls[0][1].body.get("response")).toBe("fresh");
    expect(fetch.mock.calls[0][1].body.get("secret")).toBe("fixture-server-secret");
  });
});
