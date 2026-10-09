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

Release marker: `project-context-20261009-19`. Live deployment and authenticated checks are pending. No database migration is required. Dependency-audit remediation remains separate in #22; local verification is not a claim of green GitHub CI.
