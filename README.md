# Mamyda

A personal client-work workspace: daily agenda, client/project task boards,
calendar, tagged notes, meeting minutes, and a browser-encrypted vault.
Each signed-in account owns its own data. Client records are **not** shared
organizations or SaaS tenants with members and roles.

## Development

Use Node 24 and `npm ci`. Run `sh startup.sh` to start the development app.
Authentication is enabled; create an email/password account in the app.
Without `DATABASE_URL`, development uses temporary PGlite data that disappears
when the server restarts. New accounts start empty.

- `npm test`: platform tests and application regression tests.
- `npm run test:e2e`: real browser signup, CRUD, settings, vault and isolation tests
  against a running local server. Creates disposable QA accounts; never run on production.
- `npm run typecheck` / `npm run lint`: static checks.
- `npm run build`: validates deployment configuration and emits the Vercel artifact,
  including database runtime assets. Does **not** mutate the database.
- `npm run db:migrate`: explicit, transactional PostgreSQL schema migration.
- `npm run preview:restart`: serves the built artifact for verification.

For built email-auth tests, set `BETTER_AUTH_URL=http://127.0.0.1:8081` when
starting the preview and `E2E_BASE_URL=http://127.0.0.1:8081` for the test.
Inject configuration through the environment; do not commit secrets or `.env` files.

## Status

Core workflows have regression and browser coverage. This is a foundation for a
SaaS launch, not a completed commercial SaaS service. Calendar connectors still
depend on the Grok gate; alert emails are logged, not delivered. Billing,
organizations, invitations and roles are not implemented.

See [the audit](docs/audit.md), [deployment setup](docs/deployment.md), and
[testing approach](docs/testing.md). Repository agent instructions remain in
[AGENTS.md](AGENTS.md).
