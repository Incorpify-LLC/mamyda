import { createServerFn } from "@tanstack/react-start";

/** Public widget key only. The Turnstile secret never leaves the server. */
export const turnstileSiteKey = createServerFn({ method: "GET" }).handler(async () =>
  process.env.TURNSTILE_SITE_KEY?.trim() || "",
);
