/** @param {Record<string, string | undefined>} env */
export function deploymentErrors(env) {
  /** @type {string[]} */
  const errors = [];
  const deploying = env.VERCEL === "1" || ["staging", "production"].includes(env.APP_ENV ?? "");
  if (!deploying) return errors;
  if (!["staging", "production"].includes(env.APP_ENV ?? ""))
    errors.push("APP_ENV must be staging or production");
  if (env.VITE_AUTH_ENABLED === "false") errors.push("Authentication must be enabled");
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    errors.push("DATABASE_URL must be a PostgreSQL connection URL");
  }
  try {
    const url = new URL(env.BETTER_AUTH_URL ?? "");
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash)
      throw new Error();
  } catch {
    errors.push("BETTER_AUTH_URL must be the HTTPS application origin");
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    errors.push("BETTER_AUTH_SECRET must contain at least 32 characters");
  if (!env.TURNSTILE_SECRET_KEY?.trim())
    errors.push("TURNSTILE_SECRET_KEY is required");
  if (!env.RESEND_API_KEY?.trim()) errors.push("RESEND_API_KEY is required");
  if (env.OTP_SINK === "1") errors.push("OTP_SINK must not be set for deployment");
  return errors;
}

