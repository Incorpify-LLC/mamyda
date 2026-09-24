# Mamyda

Personal desk: calendars, kanban (Client → Project → Tasks), meeting minutes,
tagged notes, and a passphrase-locked vault.

TanStack Start (Vite + React) with Better Auth and Postgres. Locally it uses
embedded PGLite; set `DATABASE_URL` for Neon/Postgres.

This is **not** yet a Cloudflare Worker. `mamyda.saneax.in` still needs a
Worker/Pages deploy, D1, R2, DNS, and (optionally) Email Sending + Access.

## Run

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Sign up with email and password. A sample workspace (Meridian Labs / Harbor & Co.)
is created on first login.

```bash
npm run build
```

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres. Unset = embedded PGLite. |
| `BETTER_AUTH_SECRET` | Auth cookie secret. Set one before any shared deploy. |
| `XAI_API_KEY` | Optional. Powers “Polish with Grok” on minutes. |

## App

- **Today** — agenda, due work, alerts
- **Calendar** — week view; Gmail/Outlook via connectors when published; Zoho via iCal URL
- **Board** — multi-client kanban
- **Minutes** — meeting notes
- **Notes** — `#tags` linked to a project
- **Vault** — OpenPGP in the browser; only ciphertext is stored
- **Settings** — calendars, alert email, sample data
