import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { beginGrokLogin } from "@/lib/mamyda/calendar";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "You",
        });
        if (err) throw new Error(err.message ?? "Could not create account");
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message ?? "Could not sign in");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  async function onGrok() {
    setError(null);
    setBusy(true);
    try {
      const result = await beginGrokLogin();
      if (result.loginUrl) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: result.loginUrl,
        });
        return;
      }
      setError(
        "Grok sign-in is available when this app is published behind the gate. Use email for now.",
      );
    } catch {
      setError("Grok sign-in is not available here. Use email.");
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
          ) : (
            <>
              <form className="space-y-4" onSubmit={onSubmit}>
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}
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
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "up"
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </form>
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "up" ? "in" : "up")}
              >
                {mode === "up"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
              <div className="my-5 flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void onGrok()}
              >
                Continue with Grok
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Grok unlocks Gmail and Outlook calendars when published. Email
                is the lock on this desk.
              </p>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
