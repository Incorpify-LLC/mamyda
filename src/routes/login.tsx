import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { turnstileSiteKey } from "@/lib/auth/public-config";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TurnstileField, type TurnstileStatus } from "@/components/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [captchaStatus, setCaptchaStatus] = useState<TurnstileStatus>("loading");

  useEffect(() => {
    void turnstileSiteKey()
      .then(setSiteKey)
      .catch(() => setSiteKey(""));
  }, []);

  useEffect(() => {
    const update = () => setResendSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    if (!resendAt || resendAt <= Date.now()) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="text-center">
          <p className="font-display text-4xl tracking-tight">Mamyda</p>
          <p className="mt-2 text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (siteKey && !token) {
      setError("Complete the check above, then ask for the code again.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.$fetch("/email-otp/send-verification-otp", {
        method: "POST",
        body: { email, type: "sign-in" },
        headers: token ? { "x-captcha-response": token } : undefined,
      });
      if (result.error) throw new Error(result.error.message ?? "Could not send the code");
      setStep("code");
      setToken("");
      setWidgetKey((value) => value + 1);
      setResendAt(Date.now() + 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
      setToken("");
      setWidgetKey((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (siteKey && !token) {
      setError("Complete the check above, then enter the code.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.$fetch("/sign-in/email-otp", {
        method: "POST",
        body: { email, otp, name: name || undefined },
        headers: token ? { "x-captcha-response": token } : undefined,
      });
      if (result.error) throw new Error(result.error.message ?? "That code was not accepted");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setToken("");
      setWidgetKey((value) => value + 1);
      setBusy(false);
    }
  }

  async function resendCode() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await authClient.$fetch("/email-otp/send-verification-otp", {
        method: "POST",
        body: { email, type: "sign-in" },
        headers: token ? { "x-captcha-response": token } : undefined,
      });
      if (result.error) throw new Error(result.error.message ?? "Could not resend the code");
      setOtp("");
      setToken("");
      setWidgetKey((value) => value + 1);
      setResendAt(Date.now() + 30_000);
      setSuccess("A new sign-in code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
      setToken("");
      setWidgetKey((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <p className="font-display text-center text-4xl tracking-tight">Mamyda</p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Calendars, board, minutes, and a locked vault — one desk.
        </p>
        <Card className="mt-8 p-6">
          {!authEnabled ? (
            <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
          ) : step === "email" ? (
            <form className="space-y-4" onSubmit={(event) => void sendCode(event)}>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
                <p className="text-xs text-muted-foreground">
                  Used only the first time this email signs in.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {siteKey && (
                <TurnstileField
                  action="auth-sign-in"
                  resetKey={widgetKey}
                  onToken={setToken}
                  onStatus={setCaptchaStatus}
                />
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || (Boolean(siteKey) && (!token || captchaStatus !== "verified"))}
              >
                {busy ? "Please wait…" : "Email me a code"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submitCode(event)}>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to {email}. It expires in five minutes.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="otp">Code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              {siteKey && (
                <TurnstileField
                  action="auth-sign-in"
                  resetKey={widgetKey}
                  onToken={setToken}
                  onStatus={setCaptchaStatus}
                />
              )}
              {error && (
                <p role="alert" aria-live="polite" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" aria-live="polite" className="text-sm text-green-700">
                  {success}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || (Boolean(siteKey) && (!token || captchaStatus !== "verified"))}
              >
                {busy ? "Please wait…" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={
                  busy ||
                  resendSeconds > 0 ||
                  (Boolean(siteKey) && (!token || captchaStatus !== "verified"))
                }
                onClick={() => void resendCode()}
              >
                {resendSeconds > 0
                  ? `Resend code in ${resendSeconds}s`
                  : busy
                    ? "Sending…"
                    : "Resend code"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError(null);
                  setSuccess(null);
                  setToken("");
                  setWidgetKey((value) => value + 1);
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
