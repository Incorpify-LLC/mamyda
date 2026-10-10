# Clear integrations and passive Settings

## Calendar connections

Settings and Calendar show the saved Google/Microsoft account identity, connection state and last successful sync (including zero imported events). OAuth credentials are never included in the read response. Missing grants, disabled sources and failed syncs are distinct; successful authorization is not a live provider-health probe. Subscription feeds remain read-only and private URLs are not displayed in summaries.

Calendar has one main **Sync all calendars** action. Individual retries are under **Sync options**, with errors visible without expansion. A failed provider or transport request does not stop attempts for the other sources; previous failed-source events are retained. Times in the agenda and sync summary are explicitly Asia/Kolkata. Event editor inputs continue to use the device timezone, now explained in the dialog. Event cards and connection summaries have readable mobile layouts.

Settings connection/removal tools and Telegram instructions are collapsed. ICS fields have persistent labels and describe the expected http(s) iCalendar subscription, read-only behavior and credential sensitivity. Removing a source requires confirmation explaining the existing imported-event deletion behavior; provider events are untouched. Reconnection still replaces the one saved account for that provider, not a second-account feature.

## Notification reads

`useAlerts` only calls `listAlerts`: opening Today, Settings, expanding history or refreshing history cannot evaluate or dispatch reminders. The existing authenticated scheduler continues to evaluate/deliver independently; explicit protected test notifications remain unchanged. Settings fetches history only when expanded. Loading/error states do not masquerade as empty logs, and testing instructions explain that real messages use saved destinations. Settings tabs support arrow/Home/End keys and proper tab/panel relationships.

## Verification and release

The read regression test initially reproduced two dispatch evaluations for two reads, then passed with zero. New API tests verify account isolation/no token exposure and passive alert reads; UI tests cover connected/missing-grant/disabled, empty imports, provider/transport partial failures, retry, lazy passive logs, loading/error/empty, labeled ICS, keyboard tabs, no idle widgets and 320/390px layouts. Browser tests render the actual routes with isolated integrations; no production provider writes, OAuth reconnection, notification sends, uploads or paid model calls occur.

All 189 app tests, type checking, scoped lint and the production build pass. Integration, editor, Board, Chat, context and verification browser checks pass; 32 standalone auth/app-data tests also pass. Visual Chrome review caught a narrow mobile identity column missed by overflow-only checks; the layout was corrected and a minimum readable-width regression added.

Released in main commit `7dbf49a`, marker `integration-clarity-20261010-21`, app image `34694dfd7fd6`. Private candidate and live health/release/security smoke pass. Signed-in Chrome verified saved Google/Microsoft identities, last-success counts, collapsed connection/log tools, passive history expansion/refresh, selected tabs, zero idle widgets and readable 320/390px layouts. Provider sync/write/reconnect and notification sends were not exercised against production; their failure/recovery states were tested with isolated providers.

Only the app container was replaced. The database, reminder scheduler, media worker and tunnel retained their container IDs; no migration, secret, key or encryption changes were required. Private source/database snapshots are under `/home/sanjayu/mamyda-rollbacks/integration-clarity-20261010-21/` on pi03. Rollback image: `mamyda-feedback-rollback:integration-clarity-20261010-21-app`. Restore code only; database restoration needs separate authorization.

CI run 38069959571 failed at the existing dependency audit against the unchanged lockfile (#22); this is not a claim of green CI. The broader platform suite also has four failures referencing missing `.grok/skills/og` assets (#23), separate from app tests and the UI changes.
