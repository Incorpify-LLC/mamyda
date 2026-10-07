import { createFileRoute } from "@tanstack/react-router";
import { readOtpSink } from "@/lib/auth/otp-mail";

/** Test-only. Refuses to exist unless OTP_SINK=1, which deployment config rejects. */
export const Route = createFileRoute("/api/otp-sink")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.OTP_SINK !== "1") return new Response("Not found", { status: 404 });
        const email = new URL(request.url).searchParams.get("email") ?? "";
        const otp = readOtpSink(email);
        if (!otp) return new Response("Not found", { status: 404 });
        return Response.json({ otp });
      },
    },
  },
});
