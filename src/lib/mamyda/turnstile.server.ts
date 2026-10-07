import { getRequest } from "@tanstack/react-start/server";

type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

function expectedHostnames(): Set<string> {
  const configured = process.env.TURNSTILE_HOSTNAMES?.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (configured?.length) return new Set(configured);
  try {
    return new Set([new URL(process.env.BETTER_AUTH_URL ?? "").hostname.toLowerCase()]);
  } catch {
    return new Set();
  }
}

/** Verifies a one-time Turnstile token sent with a server-function request. */
export async function requireTurnstile(action: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.APP_ENV === "staging" || process.env.APP_ENV === "production") {
      throw new Error("Turnstile is not configured");
    }
    return;
  }

  const request = getRequest();
  const token = request.headers.get("x-turnstile-response")?.trim();
  if (!token || token.length > 2048) throw new Error("Complete the security check and try again.");

  let result: SiteverifyResult;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") ?? "",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    result = (await response.json()) as SiteverifyResult;
  } catch {
    throw new Error("Security check could not be verified. Please try again.");
  }

  const hosts = expectedHostnames();
  if (!result.success || result.action !== action || !result.hostname || !hosts.has(result.hostname.toLowerCase())) {
    throw new Error("Security check did not match this action. Please try again.");
  }
}
