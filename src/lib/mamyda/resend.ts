export const MAIL_FROM = () =>
  process.env.MAIL_FROM?.trim() || "Mamyda <alerts@mamyda.incorpify.in>";

/** Sends one plain-text message. Throws when Resend rejects it. */
export async function sendResendEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM(), to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend rejected the message (${response.status})`);
}
