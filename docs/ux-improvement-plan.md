# UX improvement rollout

The authenticated review and user decisions define this sequence:

1. [#17](https://github.com/Incorpify-LLC/mamyda/issues/17): neutral/blue design, sans-serif headings and responsive task creation.
2. [#18](https://github.com/Incorpify-LLC/mamyda/issues/18): submission-only verification; ordinary saves complete after verification without a second click.
3. [#19](https://github.com/Incorpify-LLC/mamyda/issues/19): shared project context, simpler mobile navigation and separate personal preferences.
4. [#20](https://github.com/Incorpify-LLC/mamyda/issues/20): progressively disclosed editors and clear current Vault capabilities.
5. [#21](https://github.com/Incorpify-LLC/mamyda/issues/21): integration status, sync clarity and quieter settings without alert dispatch on read.

## First increment: implemented locally

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

Browser tests use isolated in-memory fixtures, not customer data or production CAPTCHA. Screenshots are under ignored `screenshots/board-*.png`; the local fixture was also visually reviewed in connected Chrome. Production integration testing and user feedback remain pending release approval. No commit, push or deployment was performed; issues remain open until the release is validated.
