# UX improvement rollout

The authenticated review and user decisions define this sequence:

1. [#17](https://github.com/Incorpify-LLC/mamyda/issues/17): neutral/blue design, sans-serif headings and responsive task creation.
2. [#18](https://github.com/Incorpify-LLC/mamyda/issues/18): submission-only verification; ordinary saves complete after verification without a second click.
3. [#19](https://github.com/Incorpify-LLC/mamyda/issues/19): shared project context, simpler mobile navigation and separate personal preferences.
4. [#20](https://github.com/Incorpify-LLC/mamyda/issues/20): progressively disclosed editors and clear current Vault capabilities.
5. [#21](https://github.com/Incorpify-LLC/mamyda/issues/21): integration status, sync clarity and quieter settings without alert dispatch on read.

Increment #18 is deployed and complete; see [submission verification](submission-verification.md). Signed-in desktop and mobile saves passed with real human challenge completion. The temporary test task was deleted through the protected UI, and cleanup was confirmed in the database.

Increment #19 is deployed and complete; see [shared Board context](project-context.md). Signed-in Chrome verified portable project selection, direct links and recovery, simpler mobile navigation, separate personal preferences and the Minutes project default. No customer content was modified.

## First increment: deployed

Shared light/dark tokens are neutral/blue with smaller corners. All display headings use the sans-serif family; the serif font download was removed. Client identity colors remain unchanged.

The selected project's task action is beside the work rather than in the global header. Below 768px, tasks default to a list grouped by status; desktop defaults to Kanban. Choosing either layout stores a browser-local preference. Groups show counts, empty states and contextual Add buttons. Task titles remain keyboard-operable, encrypted content remains locked, and status changes support touch/keyboard with visible failure recovery.

This increment does not change Turnstile, passphrases, stored content, client/project filters or all-project workload behavior. Those existing features remain in place.

## Verification and release boundary

Tests were written before the task-view helper (initial missing-module failure), then implemented. All 162 app tests pass, along with type checking and scoped lint (two existing-style fast-refresh warnings in the development fixture). The Board browser checks cover 320/390px overflow, desktop defaults, remembered choices, keyboard opening, contextual creation, failed moves and empty groups. Chat/recording browser regression checks also pass.

Commands:

- `npm run typecheck`
- `npm run test:app`
- `./node_modules/.bin/vite --config tests/browser/vite.config.ts`
- `node scripts/board-ui-e2e.mjs`
- `node scripts/chat-ui-e2e.mjs`

Browser tests use isolated in-memory fixtures, not customer data or production CAPTCHA. Screenshots are under ignored `screenshots/board-*.png`; the local fixture was also visually reviewed in connected Chrome.

Released with user approval as `board-ux-20261009-17` on pi03; application source pushed to main in `82b1d7a`. Candidate and live health checks passed. Connected authenticated Chrome verified desktop Kanban and mobile grouped-list defaults, sans-serif typography, the blue/neutral palette, project-local creation and no page overflow at 390px. Public smoke verified the release, protected routes/assets and rejection of anonymous recording uploads and missing-CAPTCHA OTP requests. Existing customer tasks were not changed.

Only the app container was replaced; the database, secrets, worker and tunnel were preserved. No migration was required. Image: `a94f41192b9a`. Rollback image: `mamyda-feedback-rollback:board-ux-20261009-17-app`; private source/database snapshots: `/home/sanjayu/mamyda-rollbacks/board-ux-20261009-17/` on pi03. Roll back code without restoring the database unless separately authorized.

GitHub CI run 37927521439 failed at the dependency audit, before the other checks: the unchanged lockfile contains high/critical transitive findings. Local app tests, type checking, browser checks and the production build passed; this is not a claim of green CI. Dependency remediation is tracked separately in #22. #17–#19 are complete; #20 and #21 remain open.
