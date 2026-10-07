import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { turnstileSiteKey } from "@/lib/auth/public-config";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: Login });

function TurnstileBox({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string) => void;
}) {
  useEffect(() => {
    if (!siteKey) return;
    const holder = document.getElementById("turnstile-slot");
    if (!holder) return;
    let widgetId = "";
    const render = () => {
      const turnstile = (window as unknown as {
        turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
      }).turnstile;
      if (!turnstile) return;
      holder.replaceChildren();
      widgetId = turnstile.render(holder, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing && (window as unknown as { turnstile?: unknown }).turnstile) render();
    else if (!existing) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.dataset.turnstile = "1";
      script.onload = render;
      document.head.appendChild(script);
    } else {
      existing.addEventListener("load", render, { once: true });
    }
    return () => {
      const turnstile = (window as unknown as { turnstile?: { remove: (id: string) => void } }).turnstile;
      if (widgetId && turnstile) turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey, onToken]);
  if (!siteKey) return null;
  return <div id="turnstile-slot" className="min-h-16" />;
}

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void turnstileSiteKey().then(setSiteKey).catch(() => setSiteKey(""));
  }, []);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <p className="text-xs text-muted-foreground">Used only the first time this email signs in.</p>
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
              <TurnstileBox siteKey={siteKey} resetKey={widgetKey} onToken={setToken} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
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
              <TurnstileBox siteKey={siteKey} resetKey={widgetKey} onToken={setToken} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : "Sign in"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError(null);
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
