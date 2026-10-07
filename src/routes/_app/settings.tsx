import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField, type TurnstileStatus } from "@/components/turnstile-field";
import { addIcsSource, connectProvider, removeSource } from "@/lib/mamyda/calendar";
import { useAlerts, useCalendar, useWorkspace } from "@/lib/mamyda/hooks";
import { beginTelegramLink } from "@/lib/mamyda/telegram";
import { clearSampleData, updateProfile } from "@/lib/mamyda/workspace";
import { sendTestNotification } from "@/lib/mamyda/alerts";
import { formatDay, formatTime } from "@/lib/time";
import { Bell, CalendarDays, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const ws = useWorkspace();
  const cal = useCalendar();
  const alerts = useAlerts();
  const profile = ws.data?.profile;
  const [icsName, setIcsName] = useState("Zoho");
  const [icsUrl, setIcsUrl] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [captchaAction, setCaptchaAction] = useState<
    "calendar-connect" | "calendar-feed" | "profile-update" | "alerts-test" | "telegram-link" | null
  >(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaStatus, setCaptchaStatus] = useState<TurnstileStatus>("unavailable");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Array<{
    channel: string;
    status: string;
    attempts: number;
    error: string | null;
  }> | null>(null);
  const [alertPrefs, setAlertPrefs] = useState({
    dueSoon: true,
    overdue: true,
    meeting: true,
    emailEnabled: true,
    telegramEnabled: true,
  });
  const [telegram, setTelegram] = useState<{
    command: string;
    username: string;
    link: string;
  } | null>(null);
  const [connectTarget, setConnectTarget] = useState<"google" | "outlook" | null>(null);
  const [section, setSection] = useState<"calendars" | "alerts" | "workspace">("calendars");

  const alertEmail = email ?? profile?.alertEmail ?? "";

  function requestCaptcha(action: NonNullable<typeof captchaAction>) {
    setCaptchaAction(action);
    setCaptchaToken("");
    setCaptchaError(null);
    setCaptchaStatus("loading");
    setCaptchaKey((value) => value + 1);
  }

  function resetCaptcha() {
    setCaptchaAction(null);
    setCaptchaToken("");
    setCaptchaError(null);
    setCaptchaStatus("unavailable");
    setCaptchaKey((value) => value + 1);
  }

  function retryCaptcha() {
    setCaptchaToken("");
    setCaptchaStatus("loading");
    setCaptchaKey((value) => value + 1);
  }

  const captchaReady = (action: NonNullable<typeof captchaAction>) =>
    captchaAction === action && captchaStatus === "verified" && Boolean(captchaToken);

  async function connectCalendar(provider: "google" | "outlook") {
    if (!captchaReady("calendar-connect")) {
      setConnectTarget(provider);
      if (captchaAction !== "calendar-connect") requestCaptcha("calendar-connect");
      return;
    }
    setBusyAction("calendar-connect");
    try {
      const result = await connectProvider({
        data: { provider },
        headers: { "x-turnstile-response": captchaToken },
      });
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setCaptchaError(
        error instanceof Error ? error.message : "Calendar connection failed. Retry.",
      );
      setCaptchaToken("");
      setCaptchaStatus("loading");
      setCaptchaKey((value) => value + 1);
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!profile) return;
    setAlertPrefs({
      dueSoon: profile.alertsDueSoon,
      overdue: profile.alertsOverdue,
      meeting: profile.alertsMeeting,
      emailEnabled: profile.alertsEmailEnabled,
      telegramEnabled: profile.alertsTelegramEnabled,
    });
  }, [profile]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedSection = query.get("section");
    if (
      requestedSection === "alerts" ||
      requestedSection === "workspace" ||
      requestedSection === "calendars"
    ) {
      setSection(requestedSection);
    }
    const status = query.get("calendar");
    const provider = query.get("provider") === "outlook" ? "Outlook" : "Google";
    if (status === "connected") {
      toast.success(`${provider} Calendar connected. Refresh it from the Calendar page.`);
    } else if (status === "error") {
      toast.error(query.get("message") || `${provider} Calendar authorization failed.`);
    } else {
      return;
    }
    window.history.replaceState({}, "", "/settings?section=calendars");
  }, []);

  function selectSection(next: "calendars" | "alerts" | "workspace") {
    setSection(next);
    window.history.replaceState({}, "", `/settings?section=${next}`);
  }

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <div
          className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1"
          role="tablist"
          aria-label="Settings sections"
        >
          {[
            { id: "calendars" as const, label: "Calendars", icon: CalendarDays },
            { id: "alerts" as const, label: "Email alerts", icon: Bell },
            { id: "workspace" as const, label: "Workspace", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectSection(item.id)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {section === "calendars" && (
          <Card className="p-5">
            <h2 className="font-display text-xl">Calendars</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Google or Microsoft with an account-consent screen, or add any calendar that
              provides a private iCalendar (.ics) subscription link.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  busyAction === "calendar-connect" ||
                  (captchaAction === "calendar-connect" && !captchaReady("calendar-connect"))
                }
                onClick={() => void connectCalendar("google")}
              >
                {connectTarget === "google" && captchaAction === "calendar-connect"
                  ? "Continue to Google"
                  : "Connect Google Calendar"}
              </Button>
              <Button
                variant="outline"
                disabled={
                  busyAction === "calendar-connect" ||
                  (captchaAction === "calendar-connect" && !captchaReady("calendar-connect"))
                }
                onClick={() => void connectCalendar("outlook")}
              >
                {connectTarget === "outlook" && captchaAction === "calendar-connect"
                  ? "Continue to Microsoft"
                  : "Connect Microsoft Calendar"}
              </Button>
            </div>
            {captchaAction === "calendar-connect" && (
              <div className="mt-3">
                {captchaError && (
                  <p role="alert" className="mb-2 text-sm text-destructive">
                    {captchaError}
                  </p>
                )}
                <TurnstileField
                  action="calendar-connect"
                  resetKey={captchaKey}
                  onToken={setCaptchaToken}
                  onStatus={setCaptchaStatus}
                />
              </div>
            )}
            <form
              className="mt-5 grid gap-3 sm:grid-cols-[8rem_1fr_auto]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!captchaReady("calendar-feed")) {
                  if (captchaAction !== "calendar-feed") requestCaptcha("calendar-feed");
                  return;
                }
                setBusyAction("calendar-feed");
                try {
                  const result = await addIcsSource({
                    data: { name: icsName, url: icsUrl, provider: "zoho" },
                    headers: { "x-turnstile-response": captchaToken },
                  });
                  await cal.refetch();
                  if (!result.ok) {
                    setIcsUrl("");
                    resetCaptcha();
                    setCaptchaError(
                      `Feed saved, but sync failed: ${result.error}. You can retry sync from Calendar.`,
                    );
                    return;
                  }
                  setIcsUrl("");
                  toast.success(
                    `Calendar feed added — ${result.eventCount} upcoming event${result.eventCount === 1 ? "" : "s"} found.`,
                  );
                  resetCaptcha();
                } catch (error) {
                  setCaptchaError(
                    error instanceof Error ? error.message : "Could not add calendar feed. Retry.",
                  );
                  retryCaptcha();
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              <Input
                value={icsName}
                onChange={(e) => setIcsName(e.target.value)}
                placeholder="Name"
              />
              <Input
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                placeholder="https://…/calendar.ics"
                required
              />
              <Button
                type="submit"
                disabled={
                  busyAction === "calendar-feed" ||
                  (captchaAction === "calendar-feed" && !captchaReady("calendar-feed"))
                }
              >
                {busyAction === "calendar-feed"
                  ? "Adding…"
                  : captchaReady("calendar-feed")
                    ? "Add feed"
                    : "Verify to add feed"}
              </Button>
            </form>
            {captchaAction === "calendar-feed" && (
              <div className="mt-3">
                {captchaError && (
                  <p role="alert" className="mb-2 text-sm text-destructive">
                    {captchaError}
                  </p>
                )}
                <TurnstileField
                  action="calendar-feed"
                  resetKey={captchaKey}
                  onToken={setCaptchaToken}
                  onStatus={setCaptchaStatus}
                />
              </div>
            )}
            <ul className="mt-4 space-y-2">
              {(cal.data?.sources ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {s.name} <Badge>{s.provider}</Badge>
                    {s.lastError && <span className="ml-2 text-destructive">{s.lastError}</span>}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await removeSource({ data: s.id });
                      await cal.refetch();
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {section === "alerts" && (
          <>
            <Card className="p-5">
              <h2 className="font-display text-xl">Email alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reminders run every minute, even when Mamyda is closed. Choose where each reminder
                is delivered.
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="alert-email">Your inbox</Label>
                <Input
                  id="alert-email"
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@saneax.in"
                />
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertPrefs.emailEnabled}
                    onChange={(e) =>
                      setAlertPrefs((current) => ({ ...current, emailEnabled: e.target.checked }))
                    }
                  />
                  Deliver email alerts to this inbox
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertPrefs.telegramEnabled}
                    disabled={!profile?.telegramLinked}
                    onChange={(e) =>
                      setAlertPrefs((current) => ({
                        ...current,
                        telegramEnabled: e.target.checked,
                      }))
                    }
                  />
                  Deliver alerts to Telegram
                  {!profile?.telegramLinked && " (link a Telegram account below)"}
                </label>
                <p className="pt-2 font-medium">Which reminders should Mamyda send?</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertPrefs.dueSoon}
                    onChange={(e) =>
                      setAlertPrefs((current) => ({ ...current, dueSoon: e.target.checked }))
                    }
                  />
                  Due in 24 hours
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertPrefs.overdue}
                    onChange={(e) =>
                      setAlertPrefs((current) => ({ ...current, overdue: e.target.checked }))
                    }
                  />
                  Overdue tasks
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertPrefs.meeting}
                    onChange={(e) =>
                      setAlertPrefs((current) => ({ ...current, meeting: e.target.checked }))
                    }
                  />
                  Meetings in 30 minutes
                </label>
              </div>
              <Button
                className="mt-4"
                variant="outline"
                disabled={
                  busyAction === "profile-update" ||
                  (captchaAction === "profile-update" && !captchaReady("profile-update"))
                }
                onClick={async () => {
                  if (!captchaReady("profile-update")) {
                    if (captchaAction !== "profile-update") requestCaptcha("profile-update");
                    return;
                  }
                  setBusyAction("profile-update");
                  try {
                    await updateProfile({
                      data: {
                        alertEmail: alertEmail || null,
                        alertsDueSoon: alertPrefs.dueSoon,
                        alertsOverdue: alertPrefs.overdue,
                        alertsMeeting: alertPrefs.meeting,
                        alertsEmailEnabled: alertPrefs.emailEnabled,
                        alertsTelegramEnabled: alertPrefs.telegramEnabled,
                      },
                      headers: { "x-turnstile-response": captchaToken },
                    });
                    await ws.refetch();
                    resetCaptcha();
                    toast.success("Alert preferences saved");
                  } catch (error) {
                    setCaptchaError(
                      error instanceof Error ? error.message : "Could not save preferences. Retry.",
                    );
                    retryCaptcha();
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "profile-update"
                  ? "Saving…"
                  : captchaReady("profile-update")
                    ? "Save preferences"
                    : "Verify to save"}
              </Button>
              <Button
                className="ml-2 mt-4"
                variant="outline"
                disabled={
                  busyAction === "alerts-test" ||
                  (!alertEmail && !profile?.telegramLinked) ||
                  (captchaAction === "alerts-test" && !captchaReady("alerts-test"))
                }
                onClick={async () => {
                  if (!captchaReady("alerts-test")) {
                    if (captchaAction !== "alerts-test") requestCaptcha("alerts-test");
                    return;
                  }
                  setBusyAction("alerts-test");
                  try {
                    const result = await sendTestNotification({
                      headers: { "x-turnstile-response": captchaToken },
                    });
                    setTestResult(result.deliveries);
                    resetCaptcha();
                    await alerts.refetch();
                    if (result.deliveries.every((row) => row.status === "sent"))
                      toast.success("Test notification sent on every enabled channel.");
                    else
                      toast.error(
                        "One or more channels could not send. See delivery status below.",
                      );
                  } catch (error) {
                    setCaptchaError(
                      error instanceof Error
                        ? error.message
                        : "Test notification failed; retry shortly.",
                    );
                    retryCaptcha();
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "alerts-test"
                  ? "Sending…"
                  : captchaReady("alerts-test")
                    ? "Send test notification"
                    : "Verify to send test"}
              </Button>
              {captchaAction === "alerts-test" && (
                <div className="mt-3">
                  {captchaError && (
                    <p role="alert" className="mb-2 text-sm text-destructive">
                      {captchaError}
                    </p>
                  )}
                  <TurnstileField
                    action="alerts-test"
                    resetKey={captchaKey}
                    onToken={setCaptchaToken}
                    onStatus={setCaptchaStatus}
                  />
                </div>
              )}
              {testResult && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium">Test results</p>
                  {testResult.map((row) => (
                    <p key={row.channel}>
                      {row.channel}: {row.status}
                      {row.attempts ? ` · ${row.attempts} attempt(s)` : ""}
                      {row.error ? ` — ${row.error}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {captchaAction === "profile-update" && (
                <div className="mt-3">
                  {captchaError && (
                    <p role="alert" className="mb-2 text-sm text-destructive">
                      {captchaError}
                    </p>
                  )}
                  <TurnstileField
                    action="profile-update"
                    resetKey={captchaKey}
                    onToken={setCaptchaToken}
                    onStatus={setCaptchaStatus}
                  />
                </div>
              )}
              <div className="mt-5">
                <h3 className="text-sm font-medium">Outbound log</h3>
                <ul className="mt-2 space-y-2">
                  {(alerts.data?.emails ?? []).map((m) => (
                    <li key={m.id} className="text-sm">
                      <span className="text-muted-foreground">
                        {formatDay(m.createdAt)} {formatTime(m.createdAt)}
                      </span>{" "}
                      {m.subject} · {m.status}
                      {m.lastError ? ` — ${m.lastError}` : ""}
                    </li>
                  ))}
                  {(alerts.data?.emails ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground">No mail logged yet.</li>
                  )}
                </ul>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-display text-xl">Telegram alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.telegramLinked
                  ? "This account is linked. Alerts go to Telegram as well as email."
                  : "Email works without Telegram. Linking is optional."}
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Generate a one-time link below.</li>
                <li>
                  Open the verified bot, then press Start. A bot cannot message you until you do.
                </li>
                <li>Return here and confirm the account is linked.</li>
              </ol>
              {telegram && (
                <div className="mt-3 space-y-2">
                  <Button asChild variant="secondary">
                    <a href={telegram.link} target="_blank" rel="noreferrer">
                      Open @{telegram.username} in Telegram
                    </a>
                  </Button>
                  <p className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                    Or send: {telegram.command}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await ws.refetch();
                      toast.success("Link status refreshed.");
                    }}
                  >
                    I pressed Start — check status
                  </Button>
                </div>
              )}
              <Button
                className="mt-4"
                variant="outline"
                disabled={
                  busyAction === "telegram-link" ||
                  (captchaAction === "telegram-link" && !captchaReady("telegram-link"))
                }
                onClick={async () => {
                  if (!captchaReady("telegram-link")) {
                    if (captchaAction !== "telegram-link") requestCaptcha("telegram-link");
                    return;
                  }
                  setBusyAction("telegram-link");
                  try {
                    const next = await beginTelegramLink({
                      headers: { "x-turnstile-response": captchaToken },
                    });
                    setTelegram(next);
                    resetCaptcha();
                    toast.success("Code ready. Send it to the bot.");
                  } catch (error) {
                    setCaptchaError(
                      error instanceof Error
                        ? error.message
                        : "Could not create a Telegram link. Retry.",
                    );
                    retryCaptcha();
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "telegram-link"
                  ? "Working…"
                  : captchaReady("telegram-link")
                    ? telegram
                      ? "New Telegram code"
                      : "Get a Telegram code"
                    : "Verify to link Telegram"}
              </Button>
              {captchaAction === "telegram-link" && (
                <div className="mt-3">
                  {captchaError && (
                    <p role="alert" className="mb-2 text-sm text-destructive">
                      {captchaError}
                    </p>
                  )}
                  <TurnstileField
                    action="telegram-link"
                    resetKey={captchaKey}
                    onToken={setCaptchaToken}
                    onStatus={setCaptchaStatus}
                  />
                </div>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-xl">Delivery status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Email and Telegram have separate results. Failed reminders retry automatically up to
                five times.
              </p>
              <ul className="mt-3 space-y-2">
                {(alerts.data?.alerts ?? [])
                  .flatMap((alert) => alert.deliveries.map((delivery) => ({ alert, delivery })))
                  .slice(0, 12)
                  .map(({ alert, delivery }, index) => (
                    <li
                      key={`${alert.id}-${delivery.channel}-${index}`}
                      className="border-t pt-2 text-sm"
                    >
                      <span className="font-medium">{alert.title}</span> · {delivery.channel}:{" "}
                      {delivery.status} · {delivery.attempts} attempt(s)
                      {delivery.lastError && (
                        <p
                          role={delivery.status === "failed" ? "alert" : undefined}
                          className="text-destructive"
                        >
                          {delivery.lastError}
                        </p>
                      )}
                    </li>
                  ))}
                {!(alerts.data?.alerts ?? []).some((alert) => alert.deliveries.length) && (
                  <li className="text-sm text-muted-foreground">No channel deliveries yet.</li>
                )}
              </ul>
            </Card>
          </>
        )}

        {section === "workspace" && (
          <Card className="p-5">
            <h2 className="font-display text-xl">Workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Timezone is Asia/Kolkata. New accounts start empty. You can remove legacy sample data;
              projects containing your work are preserved.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={async () => {
                await clearSampleData();
                await ws.refetch();
                await cal.refetch();
                toast.success("Sample data removed");
              }}
            >
              Remove sample data
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
