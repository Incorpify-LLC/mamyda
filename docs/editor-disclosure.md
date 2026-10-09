# Quieter editors and honest Vault controls

## Everyday actions

Notes uses **New note**, Minutes uses **New minutes**, and the unlocked Vault editor uses **New Vault note**. Saved-item lists distinguish loading and query failures from an empty or filtered view, with explicit retry and a clear next action. Existing project context and writing-draft guards are preserved.

Minutes recording tools start collapsed. The named disclosure supports keyboard activation and exposes its expanded state. Short format/size/duration guidance stays visible; full supported formats and temporary-storage guidance are available on expansion. Ready/converting status and failed-job notices remain visible while collapsed. Job status continues to poll, but transcription configuration loads only when needed. Upload progress cannot be hidden mid-transfer. Collapsing preserves the selected file and resume ticket, but clears consent, security tokens and pending deletion confirmation. Reopening never starts an upload or paid model call.

Media remains limited to 300 MiB/four hours, with the existing format support and 15-day temporary retention. Transcript review and the explicit reviewed-OK/permanent-deletion flow remain unchanged. Save minutes before deleting source media; nothing is moved to MinIO by this change.

## Vault and recovery

The irreversible passphrase-loss warning is prominent even when explanatory details are collapsed. Current capabilities replace roadmap prose: Vault notes are encrypted; Tasks/Notes can optionally encrypt content; names/dates/tags stay visible; Files/Minutes and new chats are not Vault-encrypted. Earlier encrypted chats remain readable only with their original passphrase. Keys and legacy Vault notes are workspace-wide, not project-specific.

Key setup is not displayed until the workspace profile loads successfully. Failures offer retry rather than falsely suggesting that a new key is required. Unlock remains explicit; missing passphrases cannot trigger unlock, errors stay visible, and no crypto format, key, stored content or automatic-decryption behavior is changed. Optional key-backup/export tools are collapsed; their existing plaintext-export confirmations remain intact.

## Verification and release

The disclosure browser test first failed against the previous expanded UI, then passed after implementation. New rendering tests check error/loading/empty precedence, recovery-warning placement and truthful capabilities. `node scripts/editor-ui-e2e.mjs` uses isolated data to check keyboard/collapse, retained selection, fresh consent, loading/query-error/processing/ready states, disabled reviewed-OK before saving, explicit unlock and 320/390px layouts. No real decryption, uploads or paid calls occur in these tests.

All 180 app tests, type checking, scoped lint and the production build pass. Editor, Board, Chat, context and verification browser checks pass. Signed-in live Chrome checked the collapsed/expanded recording controls, New note/New minutes labels, zero idle widgets, 320/390px layouts and the locked Vault's visible warning, capability disclosure and disabled empty-passphrase unlock. No customer content was changed or decrypted, and no real upload or paid call was made. Processing/review/error flows were verified in isolated fixtures, not production.

Released to main in `5a94873` and deployed on pi03 as `editor-disclosure-20261009-20`, image `1d90a82bf3cb`. Candidate/live health and public security/release smoke checks pass. Only the app container was replaced; no migration, key, secret or integration changes were required. Private source/database snapshots are under `/home/sanjayu/mamyda-rollbacks/editor-disclosure-20261009-20/` on pi03. The previous app image is retained as `mamyda-feedback-rollback:editor-disclosure-20261009-20-app`; do not restore the database without separate authorization.

GitHub CI run 37955505976 failed at the dependency audit against the unchanged lockfile. This is not a claim of green CI; remediation remains in #22.
