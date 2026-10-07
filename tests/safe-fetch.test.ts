import { describe, expect, it } from "vitest";
import { assertPublicUrl, isBlockedHostname, isBlockedIp } from "../src/lib/mamyda/safe-fetch";

describe("calendar URL guard", () => {
  it("blocks loopback, link-local, and private ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.9", "172.16.0.1", "169.254.1.1", "100.64.0.1", "::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("calendar.example")).toBe(false);
  });

  it("rejects a public name that resolves to the home network", async () => {
    await expect(assertPublicUrl("https://calendar.example/feed.ics", async () => ["192.168.1.4"])).rejects.toThrow(/private network/);
    await expect(assertPublicUrl("file:///etc/passwd", async () => [])).rejects.toThrow(/http/);
    const url = await assertPublicUrl("https://calendar.example/feed.ics", async () => ["93.184.216.34"]);
    expect(url.hostname).toBe("calendar.example");
  });
});
