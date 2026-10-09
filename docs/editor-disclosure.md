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

Release marker: `editor-disclosure-20261009-20`. Deployment and signed-in checks are pending. No migration or integration changes are required. Dependency-audit remediation remains in #22.
