# Board workspace feedback release — 2026-10-08

Release marker: `board-vault-feedback-20261008-1`.
Public site: https://mamyda.incorpify.in.

## Deployed scope

The current working tree was transferred to pi03 and built there, without a Git
commit or push. Live credentials and the existing Cloudflare tunnel were
preserved. The release groups Tasks, Minutes, Notes and Vault under Board and
preserves client/project context. It also includes the previously completed
workspace search and calendar write-back code missing from the older live image.

Migration `0007_vault_assets.sql` was applied using the release image. It adds
asset/revision metadata without migrating or modifying legacy content. The new
encrypted storage runtime remains disabled (`VAULT_S3_ENDPOINT` unset); login
and security protections remain enabled and `OTP_SINK` remains disabled.

Encrypted writing/file editors, individual asset locking, legacy conversion,
private MinIO runtime connectivity, scheduled cleanup and restore verification
are not delivered by this feedback release. Existing uploads still use the
legacy 8 MB workflow. Do not describe existing Notes/Minutes as encrypted.

## Verification

86 application tests and typecheck passed before deployment. The Pi Docker build
passed. A separate candidate container passed health before cutover. The public
health endpoint and release marker passed after cutover; the live app is healthy.
Public desktop/mobile sign-in rendering passed with no application errors, failed
app assets or horizontal overflow. The visible Turnstile challenge was preserved.
Local isolated browser checks previously passed Board navigation, context links,
mobile layout and hydrated dark-mode switching. Authenticated live workflows
still need user review; signed-out smoke is not a substitute for that review.

## Rollback

On pi03, the previous image is tagged
`mamyda-feedback-rollback:20261008-1454`. A pre-migration database dump and source
snapshot are retained in
`/home/sanjayu/mamyda-rollbacks/board-vault-feedback-20261008-1454/` (private directory).
The deployed image is `ed06f9209398`.

To roll back application code, tag the saved image as `mamyda_app:latest`, then
recreate only the app service using `docker-compose up -d --no-deps app` from
`/home/sanjayu/mamyda`. Do not reverse the additive migration or restore the DB
merely to roll back the UI; restoration would discard subsequent user changes.
No rollback, purge or data restoration is authorized by this runbook alone.

## Product evaluation

The stronger direction is a single client/project workspace, not four separate
destinations. Navigation and project continuity now support that direction.
The major remaining usability risk is trust: users need to distinguish legacy
unencrypted writing, locked encrypted assets, unsaved edits and failed transfers.

Recommended next product feature: an **asset status and history panel** showing
Saved/Uploading/Failed/Locked states, actionable retry, and verified revision
history. Start with truthful status indicators; add restore only after retention
and recovery are tested. This is a recommendation, not an implemented feature.

Feedback priorities: can users find each Board section, retain the expected
project, understand empty results, navigate on mobile, and tell whether work has
actually saved? Confirm those before expanding integrations or closing issues.
