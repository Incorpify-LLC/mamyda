# Staging and production

## Home staging on pi03

pi03 (Raspberry Pi 5, 8 GB) runs `compose.yml`: Postgres, a one-shot migration, the Node app, and cloudflared. pi06 keeps MinIO. The public name is `https://mamyda.incorpify.in`. The app joins the external Docker network `mamyda-web` and listens on port 3000. The tunnel's public hostname must target `http://app:3000` on that network. Do not publish Postgres or MinIO.

`npm run build` still produces the Vercel bundle. The Pi image is a different build: `docker compose build` runs `npm run build:container`, which sets Nitro's preset to `node_server`. The same image is what moves to AWS later. Change `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and the `S3_*` values. Restore a Postgres dump. Raise the app replica count. Do not run more than one copy of the Telegram poller; it takes a database lock and the loser stays quiet.

Secrets live in `deploy/.env`, gitignored, and not copied into the image. Compose also reads a root `.env` symlink to that file so `${POSTGRES_PASSWORD}` and `${TUNNEL_TOKEN}` interpolate. `APP_ENV=staging` makes `/api/health` fail closed without the Turnstile secret and the Resend key. Sign-in is an email code, not a password. `OTP_SINK=1` is for local browser tests only and is rejected in staging.

Client file bytes go to the S3 bucket. Accounts and vault text stay in Postgres. Put the database directory on an SSD when you have one (`POSTGRES_DATA`).

To build for both the Pi and AWS:

```bash
docker buildx build --platform linux/arm64,linux/amd64 -t mamyda:latest .
```

## Target and isolation

This repository currently builds a Node 24 Vercel application using Nitro. The
Cloudflare reference in the original commit is not an implemented Workers/D1
architecture. The proposed initial topology preserves Vercel and PostgreSQL.

Use **two Vercel projects** (`mamyda-staging`, `mamyda-production`), each with a
stable HTTPS domain, its own PostgreSQL database, its own auth secret and distinct
provider credentials. Each project uses its own production target; staging does
not share production data or auth cookies. Never copy live customer data into CI.

## Repository configuration

The supplied GitHub Actions workflows must first be committed and pushed. Create
GitHub environments named `staging` and `production`. Protect production with
required reviewers and restrict it to `main`; protect `main` with required CI and
PR review. Availability of environment protection depends on the repository's
GitHub plan. No environments or secrets existed when this audit inspected the repo.

Set these **environment-scoped GitHub secrets** separately for both environments:

| Name | Value |
| --- | --- |
| `VERCEL_TOKEN` | Deployment token with access to the intended project |
| `VERCEL_ORG_ID` | Vercel team/account identifier |
| `VERCEL_PROJECT_ID` | Environment-specific project identifier |
| `DATABASE_URL` | Environment-specific PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Unique cryptographically generated secret, at least 32 characters |

Set environment variables `APP_URL` to the exact stable HTTPS origin and
`RELEASE_ENABLED=true` **only after the release blockers in audit.md are resolved**.
Until then deployment fails closed. CI remains usable without deployment secrets.

Configure the corresponding Vercel project's **runtime** environment separately:
`APP_ENV=staging` or `production`, `VITE_AUTH_ENABLED=true`, `DATABASE_URL`,
`BETTER_AUTH_URL` equal to `APP_URL`, and the matching `BETTER_AUTH_SECRET`.
GitHub build secrets do not automatically configure Vercel runtime variables.
Broker/gate features require their own registered production credentials; do not
rely on the embedded preview OAuth client. Keep optional paid AI disabled until
quotas and operational controls are implemented.

Disable competing automatic Vercel Git deployments for these projects so they
cannot bypass GitHub's verification and release migrations. Never commit credentials
or generated `.vercel` output. Do not paste secrets into chat.

## Pipeline

1. PRs and pushes to `main`/`staging` run install, dependency audit, lint,
   typecheck, tests, PostgreSQL migrations and real browser tests on dev and
   built output. Screenshots are retained as seven-day CI artifacts.
2. Pushes to `staging` invoke the deploy workflow after its full CI verification.
3. Production is a manual `Deploy` run from `main`, selecting `production`,
   followed by the configured environment review.
4. Deployment validates configuration, builds, applies pending migrations using
   a transaction-scoped advisory lock, uploads the artifact with the pinned Vercel
   CLI, then probes `/api/health` for runtime configuration and database readiness.

Staging acceptance is operational: verify the intended commit in staging before
requesting the production release. The workflow does not prove that a particular
commit passed a human staging review. Never enable production while calendar SSRF,
identity lifecycle and abuse-control blockers remain unresolved.

## Migrations, rollback and operations

Add new ordered SQL files; never edit applied migrations. Use expand/contract
changes compatible with both the old and new application versions, because schema
migration precedes deployment and a failed deployment leaves the new schema in
place. The whole migration run is transactional and serialized. Migrations requiring
nontransactional operations need a separately reviewed maintenance procedure.

Rollback the application to the previous successful Vercel deployment through the
provider's rollback control. Do not automatically reverse database migrations.
Maintain independent database backups/PITR and rehearse restoration before onboarding
customers. Configure uptime/error monitoring, retention, incident response and
credential rotation. `/api/health` deliberately returns only generic readiness.

References: [Vercel GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
[Vercel prebuilt deployments](https://vercel.com/docs/cli/deploy),
[GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments),
[PGlite bundler assets](https://pglite.dev/docs/bundler-support).
