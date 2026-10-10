import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CalendarSourceSummary } from "@/components/calendar-connections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileField, type TurnstileStatus } from "@/components/turnstile-field";
import { useVerifiedToken } from "@/components/submission-verification";
import { addIcsSource, connectProvider, removeSource } from "@/lib/mamyda/calendar";
import { useAlerts, useCalendar, useWorkspace } from "@/lib/mamyda/hooks";
import { beginTelegramLink } from "@/lib/mamyda/telegram";
import { clearSampleData, updateProfile } from "@/lib/mamyda/workspace";
import { sendTestNotification } from "@/lib/mamyda/alerts";
import { DeliveryHistory } from "@/components/delivery-history";
import { Bell, CalendarDays, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { LLMSettingsPanel } from "@/components/llm-settings";

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.section === "string" &&
    ["calendars", "alerts", "workspace", "llm"].includes(search.section)
      ? { section: search.section }
      : {}),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const ws = useWorkspace();
  const cal = useCalendar();
  const [section, setSection] = useState<"calendars" | "alerts" | "workspace" | "llm">("calendars");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const alerts = useAlerts({ enabled: section === "alerts" && deliveryOpen });
  const profile = ws.data?.profile;
  const [icsName, setIcsName] = useState("");
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
  const verify = useVerifiedToken();

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
    if (busyAction) return;
    resetCaptcha();
    setBusyAction("calendar-connect");
    try {
      const captchaToken = await verify("calendar-connect", "Connecting calendar");
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
      requestedSection === "llm" ||
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

  function selectSection(next: "calendars" | "alerts" | "workspace" | "llm") {
    resetCaptcha();
    setDeliveryOpen(false);
    setSection(next);
    window.history.replaceState({}, "", `/settings?section=${next}`);
  }

  if (ws.isPending || ws.isError || !profile)
    return (
      <AppShell title="Settings">
        {ws.isError ? (
          <div role="alert">
            Could not load settings.{" "}
            <Button variant="outline" onClick={() => void ws.refetch()}>
              Retry settings
            </Button>
          </div>
        ) : (
          <p role="status">Loading settings…</p>
        )}
      </AppShell>
    );

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        {captchaError && (
          <p role="alert" className="text-sm text-destructive">
            {captchaError}
          </p>
        )}
        <div
          className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1"
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={(event) => {
            const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const tabs = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
            );
            const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next]?.focus();
            tabs[next]?.click();
          }}
        >
          {[
            { id: "calendars" as const, label: "Calendars", icon: CalendarDays },
            { id: "alerts" as const, label: "Email alerts", icon: Bell },
            { id: "workspace" as const, label: "Workspace", icon: Settings2 },
            { id: "llm" as const, label: "LLM", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`settings-tab-${item.id}`}
                aria-controls="settings-panel"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                disabled={Boolean(busyAction)}
                onClick={() => selectSection(item.id)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${section}`}
          tabIndex={0}
          className="space-y-6"
        >
          {section === "calendars" && (
            <Card className="p-5">
              <h2 className="font-display text-xl">Calendars</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect Google or Microsoft with an account-consent screen, or add any calendar that
                provides a private iCalendar (.ics) subscription link.
              </p>
              {cal.isError ? (
                <div role="alert" className="mt-4 text-sm">
                  Could not load connected calendars.{" "}
                  <Button variant="outline" size="sm" onClick={() => void cal.refetch()}>
                    Retry calendars
                  </Button>
                </div>
              ) : cal.isPending ? (
                <p role="status" className="mt-4 text-sm">
                  Loading connected calendars…
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {(cal.data?.sources ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      No calendars connected. Open connection tools below to add one.
                    </li>
                  )}
                  {(cal.data?.sources ?? []).map((source) => (
                    <li key={source.id} className="border-t pt-3">
                      <CalendarSourceSummary source={source} />
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm">Manage {source.name}</summary>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Removing a calendar also removes its imported events from Mamyda, not from
                          your provider. Reconnect using connection tools below.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          disabled={Boolean(busyAction)}
                          onClick={async () => {
                            if (
                              busyAction ||
                              !window.confirm(
                                `Remove ${source.name} and its imported events from Mamyda? Provider events will not be deleted.`,
                              )
                            )
                              return;
                            setBusyAction(`remove-${source.id}`);
                            try {
                              await removeSource({ data: source.id });
                              await cal.refetch();
                              toast.success("Calendar removed from Mamyda");
                            } catch (error) {
                              setCaptchaError(
                                error instanceof Error
                                  ? error.message
                                  : "Could not remove calendar. Retry.",
                              );
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                        >
                          {busyAction === `remove-${source.id}` ? "Removing…" : "Remove calendar"}
                        </Button>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-5 border-t pt-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Connect or reconnect a calendar
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  One Google and one Microsoft account per workspace. Reconnecting replaces that
                  provider's authorization; it does not add a second account.
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
                    Connect Google Calendar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      busyAction === "calendar-connect" ||
                      (captchaAction === "calendar-connect" && !captchaReady("calendar-connect"))
                    }
                    onClick={() => void connectCalendar("outlook")}
                  >
                    Connect Microsoft Calendar
                  </Button>
                </div>
                <form
                  className="mt-5 grid items-end gap-3 sm:grid-cols-[8rem_1fr_auto]"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busyAction) return;
                    resetCaptcha();
                    setBusyAction("calendar-feed");
                    try {
                      const captchaToken = await verify("calendar-feed", "Checking submission");
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
                        error instanceof Error
                          ? error.message
                          : "Could not add calendar feed. Retry.",
                      );
                      retryCaptcha();
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="ics-name">Feed name</Label>
                    <Input
                      id="ics-name"
                      value={icsName}
                      onChange={(e) => setIcsName(e.target.value)}
                      placeholder="Team calendar"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ics-url">iCalendar subscription URL</Label>
                    <Input
                      id="ics-url"
                      type="url"
                      aria-describedby="ics-help"
                      value={icsUrl}
                      onChange={(e) => setIcsUrl(e.target.value)}
                      placeholder="https://…/calendar.ics"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      busyAction === "calendar-feed" ||
                      (captchaAction === "calendar-feed" && !captchaReady("calendar-feed"))
                    }
                  >
                    {busyAction === "calendar-feed" ? "Adding…" : "Add feed"}
                  </Button>
                </form>
                <p id="ics-help" className="mt-2 text-xs text-muted-foreground">
                  Use an http(s) link returning iCalendar (.ics), not an HTML calendar page or file
                  upload. Zoho and other subscription feeds are read-only. Treat private feed URLs
                  like passwords.
                </p>
              </details>
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
                    if (busyAction) return;
                    resetCaptcha();
                    setBusyAction("profile-update");
                    try {
                      const captchaToken = await verify("profile-update", "Checking submission");
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
                        error instanceof Error
                          ? error.message
                          : "Could not save preferences. Retry.",
                      );
                      retryCaptcha();
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "profile-update" ? "Saving…" : "Save preferences"}
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
                <p className="mt-2 text-xs text-muted-foreground">
                  Test notifications use your saved destinations and send a real message. Save
                  preference changes before testing.
                </p>
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
              </Card>

              <Card className="p-5">
                <h2 className="font-display text-xl">Telegram alerts</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile?.telegramLinked
                    ? "Account linked. Delivery follows your saved Telegram alert preference."
                    : "Email works without Telegram. Linking is optional."}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm">How Telegram linking works</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Generate a one-time link below.</li>
                    <li>
                      Open the verified bot, then press Start. A bot cannot message you until you
                      do.
                    </li>
                    <li>Return here and confirm the account is linked.</li>
                  </ol>
                </details>
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
                    if (busyAction) return;
                    resetCaptcha();
                    setBusyAction("telegram-link");
                    try {
                      const captchaToken = await verify("telegram-link", "Checking submission");
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
                    : telegram
                      ? "New Telegram code"
                      : "Get a Telegram code"}
                </Button>
              </Card>
              <Card className="p-5">
                <details
                  open={deliveryOpen}
                  onToggle={(event) => setDeliveryOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer font-medium">
                    Delivery history and logs
                  </summary>
                  {deliveryOpen && (
                    <DeliveryHistory
                      loading={alerts.isPending}
                      error={alerts.isError}
                      data={alerts.data}
                      onRefresh={() => void alerts.refetch()}
                    />
                  )}
                </details>
              </Card>
            </>
          )}
        </div>

        {section === "llm" && <LLMSettingsPanel />}
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
