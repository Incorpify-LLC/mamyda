import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

export function isBlockedIp(ip: string): boolean {
  let value = ip.trim().toLowerCase();
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) value = mapped[1];
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return value.includes(":") ? false : isIP(value) !== 0;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export function isBlockedHostname(host: string): boolean {
  const name = host.trim().toLowerCase().replace(/\.$/, "");
  if (!name) return true;
  if (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name.endsWith(".local") ||
    name.endsWith(".internal") ||
    name === "metadata.google.internal"
  ) {
    return true;
  }
  if (isIP(name)) return isBlockedIp(name);
  return false;
}

export type AddressLookup = (hostname: string) => Promise<string[]>;

async function defaultLookup(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/** Rejects non-http(s) URLs and any name that resolves to a private or local address. */
export async function assertPublicUrl(raw: string, resolve: AddressLookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Calendar URL is not a valid address");
  }
  if (url.username || url.password) throw new Error("Calendar URL must not include a password");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Calendar URL must be http or https");
  }
  if (isBlockedHostname(url.hostname)) throw new Error("Calendar URL points at a private network");
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname);
  } catch {
    throw new Error("Calendar URL could not be resolved");
  }
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) {
    throw new Error("Calendar URL points at a private network");
  }
  return url;
}

/** Fetches text from a public URL, re-checking every redirect, with a size cap and timeout. */
export async function fetchPublicText(raw: string, resolve?: AddressLookup): Promise<string> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current, resolve);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/calendar, text/plain, */*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Calendar fetch failed (redirect)");
      current = new URL(location, url).href;
      continue;
    }
    if (!response.ok) throw new Error(`Calendar fetch failed (${response.status})`);
    if (!response.body) throw new Error("Calendar fetch failed (empty)");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("Calendar feed is too large");
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new Error("Calendar URL redirected too many times");
}
