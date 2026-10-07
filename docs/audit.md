# Repository audit

## Findings and fixes

The initial build/typecheck passed, but 11 platform tests failed because they
assumed an untouched template. No application-specific TDD history was found.

| Finding | Resolution |
| --- | --- |
| Built app crashed because PGlite WASM/data files were absent | Build now copies runtime assets into the server artifact |
| Task/project edits ignored the selected parent | Parent IDs are persisted |
| Notes/minutes accepted links to other accounts' records | Verify ownership before writes; regressions cover both accounts |
| Updating another account's note could create orphan tags | Reject missing/unowned note before tag mutations |
| Vault key setup could replace keys and strand ciphertext | Atomic create-only key setup rejects replacement |
| Unlocked vault private key persisted in session storage | In-memory key only; legacy key removed; account-change cleanup |
| Account-independent query cache | Clear cached app data when identity changes |
| Typed-only validators accepted malformed runtime input | Zod limits/types applied to workspace and writing mutations |
| Clearing alert email restored the old address | Explicit null update and controlled preference input |
| Concurrent alert polling raised duplicate-key errors | Conflict-safe insert creates only one alert/email log |
| Logged alerts falsely had a sent timestamp | Leave sent timestamp unset |
| Removing sample parents orphaned user-created work | Preserve parents with dependent records |
| New accounts silently seeded demo client data | New accounts start empty |
| ICS TZID ignored and invalid dates normalized | Respect timezone parameters, use workspace timezone for floating values, reject invalid dates |
| Browser QA passed empty pages and ignored baseline divergence | Failure exit codes now cover both, plus overflow |
| No deployment gates; build applied migrations | Separate release migration, required deployment env validation, health check |
| High-severity transitive js-yaml advisory | Lockfile updated; npm audit reports no known vulnerabilities at verification |
| Generated Vercel artifacts tracked | Removed from Git index; ignored along with dependencies and test captures |

## Release blockers and remaining limitations

1. **Calendar feeds:** arbitrary HTTP(S) URLs are fetched server-side with redirects,
   without private-network protection, timeout or response-size cap. Treat this as
   an SSRF release blocker. Refresh deletes/reinserts events and can break minutes
   links; recurrence, pagination and provider-specific normalization need tests.
   Connector methods are guessed rather than verified against the live gate.
   The AGENTS.md-required `.grok/skills/app-data/SKILL.md` is absent, including the
   searched local skill catalogs. External integration changes were deferred.
2. **Commercial identity:** email signup works locally, but email verification,
   password recovery, account deletion and durable abuse controls need product
   implementation. Broker/gate credentials and callback configuration require a
   real staging integration test. The shared preview client is not production setup.
3. **Notifications/AI:** alerts run while the app is used; emails are only logged.
   Add an authenticated scheduler, delivery provider and retries. AI minutes polish
   has a token cap and bounded input but still needs per-account quotas, request
   timeout and verified model/provider configuration. No paid external calls were made.
4. **SaaS model:** current isolation is per individual account. No organization
   membership, roles, invitations, subscription billing, entitlements or usage quotas.
5. **Data integrity/operations:** most parent relationships have no database foreign
   keys; several multi-query mutations are not transactional. Add compatible schema
   constraints after auditing existing data. Backups, restore drills, monitoring,
   alert delivery, support and retention procedures remain to be configured.
6. **Timezones:** the UI uses Asia/Kolkata. Full per-user timezone/DST behavior and
   recurring calendar event expansion need separate implementation.

Do not enable public production releases until blockers are resolved. Deployment
workflows are provided but are disabled by configuration until explicitly enabled.
No cloud deployment, repository push, billing integration or secret provisioning
was performed in this audit.

## Verification evidence

- 253 tests passed (200 Node platform tests, 32 auth/app-data identity tests,
  21 Vitest application tests), including a run on Node 24.
- Typecheck passed; lint passed with five existing warnings.
- Dependency audit reported zero known vulnerabilities.
- Desktop/mobile dev and built smoke checks showed visible content, no browser
  errors or page overflow, and no baseline divergence; screenshots were inspected.
- The expanded authenticated browser workflow passed against dev and built output.
- Workflow YAML parsed successfully. GitHub Actions jobs and remote Vercel/PostgreSQL
  infrastructure have not been executed/provisioned, so cloud readiness is not claimed.
