import { spawn } from "node:child_process";

// Compose must not embed the password in a URL. Characters such as @, :, #, and
// $ would be parsed as part of the URL or swallowed as interpolation.
const password = process.env.POSTGRES_PASSWORD ?? "";
const host = process.env.POSTGRES_HOST || "postgres";
if (!process.env.DATABASE_URL?.trim() && password) {
  process.env.DATABASE_URL = `postgres://mamyda:${encodeURIComponent(password)}@${host}:5432/mamyda`;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/container-entrypoint.mjs <command> [args]");
  process.exit(2);
}
const child = spawn(command, args, { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
