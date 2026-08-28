import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import {
  addIcsSource,
  connectProvider,
  removeSource,
} from "@/lib/mamyda/calendar";
import { useAlerts, useCalendar, useWorkspace } from "@/lib/mamyda/hooks";
import { clearSampleData, updateProfile } from "@/lib/mamyda/workspace";
import { formatDay, formatTime } from "@/lib/time";
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
  const [email, setEmail] = useState("");

  const alertEmail = email || profile?.alertEmail || "";

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="p-5">
          <h2 className="font-display text-xl">Calendars</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gmail and Outlook use Grok connectors when this app is published.
            Zoho (and anything else) can be added as an iCal URL.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const result = await connectProvider({ data: { provider: "google" } });
                if ("loginRequired" in result && result.loginRequired && result.loginUrl) {
                  redirectToLoginIfRequired({
                    ok: false,
                    data: null,
                    loginRequired: true,
                    loginUrl: result.loginUrl,
                  });
                  return;
                }
                await cal.refetch();
                toast.success("Google calendar connected");
              }}
            >
              Connect Gmail
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const result = await connectProvider({
                  data: { provider: "outlook" },
                });
                if ("loginRequired" in result && result.loginRequired && result.loginUrl) {
                  redirectToLoginIfRequired({
                    ok: false,
                    data: null,
                    loginRequired: true,
                    loginUrl: result.loginUrl,
                  });
                  return;
                }
                await cal.refetch();
                toast.success("Outlook connected");
              }}
            >
              Connect Outlook
            </Button>
          </div>
          <form
            className="mt-5 grid gap-3 sm:grid-cols-[8rem_1fr_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              await addIcsSource({
                data: { name: icsName, url: icsUrl, provider: "zoho" },
              });
              setIcsUrl("");
              await cal.refetch();
              toast.success("Calendar feed added");
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
              placeholder="https://calendar.zoho.com/ical/…"
              required
            />
            <Button type="submit">Add feed</Button>
          </form>
          <ul className="mt-4 space-y-2">
            {(cal.data?.sources ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {s.name}{" "}
                  <Badge>{s.provider}</Badge>
                  {s.lastError && (
                    <span className="ml-2 text-destructive">{s.lastError}</span>
                  )}
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

        <Card className="p-5">
          <h2 className="font-display text-xl">Email alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From <span className="font-medium">alerts@mamyda.saneax.in</span> to
            you. Queued here now; Cloudflare Email Sending is the production
            path.
          </p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="alert-email">Your inbox</Label>
            <Input
              id="alert-email"
              type="email"
              defaultValue={profile?.alertEmail ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@saneax.in"
            />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={profile?.alertsDueSoon ?? true}
                onChange={(e) =>
                  void updateProfile({ data: { alertsDueSoon: e.target.checked } })
                }
              />
              Due in 24 hours
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={profile?.alertsOverdue ?? true}
                onChange={(e) =>
                  void updateProfile({ data: { alertsOverdue: e.target.checked } })
                }
              />
              Overdue tasks
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={profile?.alertsMeeting ?? true}
                onChange={(e) =>
                  void updateProfile({ data: { alertsMeeting: e.target.checked } })
                }
              />
              Meetings in 30 minutes
            </label>
          </div>
          <Button
            className="mt-4"
            variant="outline"
            onClick={async () => {
              await updateProfile({ data: { alertEmail: alertEmail || null } });
              await ws.refetch();
              toast.success("Alert preferences saved");
            }}
          >
            Save
          </Button>
          <div className="mt-5">
            <h3 className="text-sm font-medium">Outbound log</h3>
            <ul className="mt-2 space-y-2">
              {(alerts.data?.emails ?? []).map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="text-muted-foreground">
                    {formatDay(m.createdAt)} {formatTime(m.createdAt)}
                  </span>{" "}
                  {m.subject}
                </li>
              ))}
              {(alerts.data?.emails ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">No mail logged yet.</li>
              )}
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-xl">Workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Timezone is Asia/Kolkata. Sample clients and events are there so
            the desk is not empty — remove them when you are ready.
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

        <Card className="p-5">
          <h2 className="font-display text-xl">Cloudflare production</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            DNS for mamyda.saneax.in is already in place. When you are ready to
            host this on Cloudflare:
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Workers Paid + Zero Trust on the account</li>
            <li>Worker custom domain mamyda.saneax.in</li>
            <li>D1 database for this schema, private R2 bucket for vault blobs</li>
            <li>Access policy: your email only, one-time PIN or Google</li>
            <li>Email Sending onboarded on mamyda.saneax.in</li>
            <li>Cron every 10 minutes to sync calendars and fire alerts</li>
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
