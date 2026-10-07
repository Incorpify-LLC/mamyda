# Mamyda

A personal client-work workspace: daily agenda, client/project task boards,
calendars, tagged notes, meeting minutes, and a browser-encrypted vault.
Each signed-in account owns its own data.

## Development

Use Node 24 and `npm ci`. Run `sh startup.sh` to start development.
Without `DATABASE_URL`, development uses temporary PGlite data that disappears
when the server restarts. New accounts start empty.

- `npm test`: platform and application regression tests.
- `npm run test:e2e`: browser signup, CRUD, settings, vault and isolation tests
  against a local server. Creates disposable accounts; never run on production.
- `npm run typecheck` / `npm run lint`: static checks.
- `npm run build`: emits the Vercel artifact without modifying the database.
- `npm run build:container`: builds the Node service used on pi03.
- `npm run db:migrate`: transactional PostgreSQL schema migration.
- `npm run preview:restart`: serves the built artifact for verification.

Inject configuration through the environment. Never commit secrets or `.env` files.
See [deployment setup](docs/deployment.md), [testing](docs/testing.md), and
[the audit](docs/audit.md).

## Integrations

Google and Microsoft calendars use direct OAuth with encrypted token storage.
Google requests event read/write access; Microsoft requests calendar read/write
access. Calendar Sync imports upcoming events. Private iCalendar subscription
links support other providers. Write consent alone does not create event-editing
controls in Mamyda.

Sync covers Google primary/Outlook default calendars and subscribed feeds from
14 days ago through 90 days ahead, following provider pagination. The Calendar
page reports each source's last successful sync, event count and errors, with
Retry and a link to reconnect. Refreshes preserve event IDs and linked minutes;
removed imported events are hidden but their historical links are retained.

Notes and Minutes prompt to save, discard or cancel when switching work or
leaving the editor. Unsaved drafts can be recovered after refresh in the same
tab, are isolated per account, and are cleared on sign-out. This is temporary
recovery, not backup: save before closing the tab. Vault plaintext is never
included. Failed saves keep the draft and allow retry.

Email OTP and alerts use Resend. Telegram alerts use a verified bot with one-time
account linking. Turnstile protects the integrated forms. Settings has Calendar,
Email alerts, and Workspace tabs; the header provides a persistent theme toggle.

The live deployment is `https://mamyda.incorpify.in`, served by Node and PostgreSQL
on pi03 through a Cloudflare Tunnel. Billing, shared organizations, invitations,
and roles are not implemented.
