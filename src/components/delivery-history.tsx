import { Button } from "@/components/ui/button";
import { APP_TZ, formatDay, formatTime } from "@/lib/time";
import type { AlertRow, EmailLog } from "@/lib/mamyda/types";

export function DeliveryHistory({
  loading,
  error,
  data,
  onRefresh,
}: {
  loading: boolean;
  error: boolean;
  data?: { alerts: AlertRow[]; emails: EmailLog[] };
  onRefresh: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="mt-3 text-sm">
        Could not load delivery history.{" "}
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Retry history
        </Button>
      </div>
    );
  if (loading)
    return (
      <p role="status" className="mt-3 text-sm">
        Loading delivery history…
      </p>
    );
  const deliveries = (data?.alerts ?? [])
    .flatMap((alert) => alert.deliveries.map((delivery) => ({ alert, delivery })))
    .slice(0, 12);
  return (
    <div className="mt-3 space-y-4 break-words text-sm">
      <p className="text-muted-foreground">
        Email and Telegram have separate results. Failed reminders retry automatically up to five
        times. Reading or refreshing this history never sends a notification. Times: {APP_TZ}.
      </p>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        Refresh history
      </Button>
      <h3 className="font-medium">Channel deliveries</h3>
      {deliveries.length ? (
        <ul className="space-y-2">
          {deliveries.map(({ alert, delivery }, index) => (
            <li key={`${alert.id}-${delivery.channel}-${index}`} className="border-t pt-2">
              {alert.title} · {delivery.channel}: {delivery.status} · {delivery.attempts} attempt(s)
              {delivery.lastError && <p className="text-destructive">{delivery.lastError}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No channel deliveries yet.</p>
      )}
      <h3 className="font-medium">Outbound email log</h3>
      {(data?.emails ?? []).length ? (
        <ul className="space-y-2">
          {data!.emails.map((mail) => (
            <li key={mail.id}>
              {formatDay(mail.createdAt)} {formatTime(mail.createdAt)} · {mail.subject} ·{" "}
              {mail.status}
              {mail.lastError && <p className="text-destructive">{mail.lastError}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No mail logged yet.</p>
      )}
    </div>
  );
}
