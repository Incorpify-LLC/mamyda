# Clear integrations and passive Settings

## Calendar connections

Settings and Calendar show the saved Google/Microsoft account identity, connection state and last successful sync (including zero imported events). OAuth credentials are never included in the read response. Missing grants, disabled sources and failed syncs are distinct; successful authorization is not a live provider-health probe. Subscription feeds remain read-only and private URLs are not displayed in summaries.

Calendar has one main **Sync all calendars** action. Individual retries are under **Sync options**, with errors visible without expansion. A failed provider or transport request does not stop attempts for the other sources; previous failed-source events are retained. Times in the agenda and sync summary are explicitly Asia/Kolkata. Event editor inputs continue to use the device timezone, now explained in the dialog. Event cards and connection summaries have readable mobile layouts.

Settings connection/removal tools and Telegram instructions are collapsed. ICS fields have persistent labels and describe the expected http(s) iCalendar subscription, read-only behavior and credential sensitivity. Removing a source requires confirmation explaining the existing imported-event deletion behavior; provider events are untouched. Reconnection still replaces the one saved account for that provider, not a second-account feature.

## Notification reads

`useAlerts` only calls `listAlerts`: opening Today, Settings, expanding history or refreshing history cannot evaluate or dispatch reminders. The existing authenticated scheduler continues to evaluate/deliver independently; explicit protected test notifications remain unchanged. Settings fetches history only when expanded. Loading/error states do not masquerade as empty logs, and testing instructions explain that real messages use saved destinations. Settings tabs support arrow/Home/End keys and proper tab/panel relationships.

## Verification and release

The read regression test initially reproduced two dispatch evaluations for two reads, then passed with zero. New API tests verify account isolation/no token exposure and passive alert reads; UI tests cover connected/missing-grant/disabled, empty imports, provider/transport partial failures, retry, lazy passive logs, loading/error/empty, labeled ICS, keyboard tabs, no idle widgets and 320/390px layouts. Browser tests render the actual routes with isolated integrations; no production provider writes, OAuth reconnection, notification sends, uploads or paid model calls occur.

Release marker: `integration-clarity-20261010-21`. Deployment and live verification pending. No migration, secret, key or encryption changes are required. Dependency audit remains tracked in #22. The broader platform suite also references missing `.grok/skills/og` assets (#23); this is separate from app tests and the UI changes.
