# pi03 deploy direction (2026-09-24)

Home staging is pi03 (Pi 5, 8 GB): Postgres, the Node app, cloudflared. MinIO stays on pi06. Public name `https://mamyda.incorpify.in`, closed to you until Turnstile, Resend, and the calendar URL check are configured.

Sign-in is email OTP, not a password. Telegram is optional and linked after signup. `compose.yml` reads gitignored `deploy/.env` (root `.env` is a symlink to it). The app and cloudflared join external Docker network `mamyda-web`; the tunnel origin is `http://app:3000`. `npm run build` is still the Vercel bundle; the Pi image uses `node_server` via `build:container`. Not deployed, and no secrets were written.
