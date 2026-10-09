# Shared Board context and personal preferences

## Behavior

Tasks, Minutes, Notes, Files and Vault share a visible client/project selector. Section links carry the resolved IDs, not stale task/note/minute IDs. URL selection is authoritative; Back restores it. Project-only links resolve the owning client, and direct task/note/minute links resolve their asset's project. Missing, archived or mismatched selections show explicit recovery instead of displaying another project's assets. Archived clients/projects are excluded from the selector. Tasks and Files resolve their initial active project into the URL; unscoped Notes/Minutes retain their all-project view.

Returning to Board through navigation retains the last context in memory during the signed-in session. It is reset when the account changes and is not written to browser storage. Writing-editor route blockers continue to protect unsaved drafts; accepted scope changes clear the previous selected editor. File scope changes clear the upload selection; the selector is disabled during transfer.

Vault carries navigation context, but its existing keys and legacy Vault notes remain workspace-wide. This does not implement project-specific keys or file/minute encryption. No existing content is automatically decrypted.

## Navigation and preferences

Mobile's bottom navigation contains Today, Calendar, Board and More. More exposes Clients/Projects, LLM Chat, Settings, Preferences and account access. Board sections remain directly available in a horizontally scrollable strip at narrow widths. The menu has a named dialog and keyboard focus management.

Preferences is a protected route separate from workspace integrations. Theme (device/light/dark), task spacing and default task layout apply to this browser only. Existing theme/layout choices are preserved; Automatic restores mobile grouped-list and desktop Kanban defaults. Local display preferences do not submit to the server or require CAPTCHA. Workspace security checks and integrations are unchanged.

## Verification

Resolver tests began with a missing-module failure, then passed after implementation. All 177 app tests, type checking, the production build, scoped lint (fast-refresh warnings only), and Board/Chat/submission-verification browser regressions passed. `node scripts/context-ui-e2e.mjs` tests the real shell/selector/preferences with isolated read-only workspace data: section portability, Back, Calendar return, project-only links, recovery, keyboard controls, 320/390px overflow, More destinations and saved preferences. Mobile was visually reviewed in connected Chrome. These fixtures do not prove production data writes.

## Live release

Released as `project-context-20261009-19`, source commits `b758a8f`, `10408b8` and `51fe075`, ARM64 image `2500e6655ad9`. Private candidate health/release checks and public live smoke passed. Only the app container was replaced; no migration ran, and database, secrets, worker, scheduler and tunnel were preserved. A smoke attempt during the initial app restart saw a transient 502; checks were rerun successfully once the app was ready. App and database are healthy.

Authenticated Chrome verified desktop section links retaining the same project across Notes, Minutes, Files and locked Vault; the menu and Preferences on mobile; working theme/spacing/layout choices with original choices restored; project-only direct links; explicit missing-project recovery without an unrelated task board; and no page overflow at 320/390px. Live review caught and fixed the cached-workspace Minutes default: both the current context and the initial blank editor now select the same project. Loading context now waits for workspace data before displaying recovery. No customer content was edited, deleted or decrypted, and no paid model or calendar write was triggered. Back, archived/mismatched recovery and keyboard selection were additionally covered in the isolated fixture.

Rollback image: `mamyda-feedback-rollback:project-context-20261009-19-app` (previous image `1705b29c4415`). A private database snapshot is under `/home/sanjayu/mamyda-rollbacks/project-context-20261009-19/` on pi03. Roll back code without restoring the database unless separately authorized.

GitHub run `37952708562` failed at `npm audit --audit-level=high` with the unchanged lockfile. Dependency-audit remediation remains separate in #22; local verification is not a claim of green GitHub CI. #19 is complete.
