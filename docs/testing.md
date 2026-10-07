# Testing approach

## Was this project developed using TDD?

The available history contains two commits (`d9a222f`, `df2654a`). The application
and template infrastructure arrived together in one large commit. There are no
visible red/green/refactor commits or application feature tests predating the
implementation. Existing tests target the template's auth, environment, migrations,
PWA and browser tooling. Therefore TDD cannot be confirmed; the presence of tests
alone is not evidence of test-first development.

## Current tests

- `npm run test:platform`: Node test-runner coverage of platform utilities and auth
  identity verification. Template-specific fixtures no longer assume Mamyda is
  auth-disabled or unbranded.
- `npm run test:app`: Vitest regression tests using real PGlite and the application's
  actual SQL handlers. Only the TanStack transport and verified identity boundary
  are mocked. These tests do not prove HTTP authentication; browser/auth tests cover
  that separately. Includes validation, account-scoped links, CRUD relationships,
  alert deduplication, vault encryption and calendar date parsing.
- `npm run test:e2e`: Playwright drives real email signup and signed-in routes,
  client/project/task creation and persistence, notes, minutes, clearing preferences,
  vault setup/lock, mobile board layout, signout and a second empty account.
- `scripts/browser-smoke.mjs`: desktop/mobile render and console checks on dev and
  built output, with baseline comparison. Blank content, overflow, runtime errors
  and production divergence produce failure exit codes.

Run browser tests only against isolated local/CI databases. They create disposable
accounts and never delete real user data. CI provisions PostgreSQL and applies
migrations twice to check fresh installation and rerun behavior. Local SQL
regressions use PGlite; production-provider configuration still needs staging QA.

## Test-first fixes

During this audit, regression tests were executed before fixes: 11 failing
application regressions, a failing browser-storage vault regression, calendar
parsing regression, and failing smoke-verdict regressions were reproduced. They
were then rerun after implementation. Keep this process for subsequent bugs:
write a behavior-level failing test, make the smallest fix, then run the relevant
suite and integration checks. No numerical coverage threshold is claimed.
