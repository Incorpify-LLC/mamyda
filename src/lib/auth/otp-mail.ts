import { ensureDbReady } from "@/lib/db";
import { allowHit } from "@/lib/mamyda/rate-limit";
import { sendResendEmail } from "@/lib/mamyda/resend";

const sink = new Map<string, string>();

export function readOtpSink(email: string): string | undefined {
  return sink.get(email.trim().toLowerCase());
}

/** Better Auth hook: mail a sign-in code, or keep it in memory when OTP_SINK=1. */
export async function sendVerificationOTP(data: { email: string; otp: string; type: string }): Promise<void> {
  if (data.type !== "sign-in") return;
  await ensureDbReady();
  const email = data.email.trim().toLowerCase();
  const allowed = await allowHit(`otp:${email}`, 5, 10 * 60_000);
  if (!allowed) throw new Error("Too many codes for this email. Wait a few minutes.");
  const deployed = ["staging", "production"].includes(process.env.APP_ENV ?? "") || process.env.VERCEL === "1";
  if (!deployed && (process.env.OTP_SINK === "1" || !process.env.RESEND_API_KEY?.trim())) {
    sink.set(email, data.otp);
    console.info(`[otp] ${email} ${data.otp} (local only; set RESEND_API_KEY to mail it)`);
    return;
  }
  await sendResendEmail(
    email,
    "Your Mamyda sign-in code",
    `Your sign-in code is ${data.otp}. It expires in 5 minutes. If you did not ask for it, ignore this message.`,
  );
}
