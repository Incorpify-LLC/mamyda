# Task and Note content encryption feedback release

Release: `private-content-feedback-20261008-3`. Git changes remain unpushed for review.
Live image: `434a6a8103bc`. Migration `0009_private_content.sql` is applied.

## User flow

1. Create a Vault key and download/verify its protected key backup.
2. Open a Task or Note and choose **Encrypt content with my Vault key**.
3. Read the recovery warning and save. Content is encrypted in the browser.
4. Reopen the item: the body is locked. **Unlock content** requires the passphrase.
5. **Lock content** clears readable content. Dirty content requires explicit discard.

Names, dates and tags remain visible/searchable. Encrypted note names are entered
separately, avoiding automatic disclosure of the first private sentence. Tags are
extracted locally before encryption. Task reminders can use visible metadata.

The on-screen warning states: forgotten passphrases cannot be reset by Mamyda and
encrypted content cannot be recovered without the original key and passphrase.
Protected key backups must be stored separately from passphrases. Earlier database
backups or previously sent content are not retroactively erased by encryption.

## Security and scope

Ciphertext goes to the existing configured private S3-compatible store under opaque
`content/<owner-hash>/<uuid>` keys. PostgreSQL stores object references/fingerprints;
task notes become NULL and note bodies become empty. Database constraints reject
plaintext alongside encrypted references. Server validation rejects stale plaintext
editors and wrong key recipients; conditional updates guard concurrent conversions.
Authenticated owner-only reads return ciphertext. Passphrases and decrypted keys
never go to the backend. Saves keep their existing server-side Turnstile gates.
Encrypted drafts do not enter browser draft storage; query caches contain metadata
and empty bodies, not the unlocked content.

This release supports the existing workspace key only. Files and Minutes are not
encrypted yet; independent client/project keys and batch encryption remain pending.
No automatic legacy conversion occurs. Superseded ciphertext objects are retained;
orphan/version cleanup needs a separate conservative retention policy.

## Verification and operations

102 app tests pass, along with typecheck and container build. Tests cover plaintext
rejection, database privacy constraints, metadata preservation, foreign-owner reads,
wrong passphrases and incorrect key recipients. Local browser round trips for Tasks
and Notes pass using isolated in-memory storage and a test-only security widget;
production auth/security settings are unchanged. Saving/locking clears body text;
reload does not automatically decrypt it. Authenticated live verification remains
for user feedback.

Migration `0009_private_content.sql` is additive. Before deployment, private source
and database backups were taken under
`/home/sanjayu/mamyda-rollbacks/private-content-feedback-20261008-1702/`.
Rollback image: `mamyda-feedback-rollback:20261008-1702` (`497986eea1a7`).
An older UI cannot unlock these newly encrypted items; prefer fixing forward or
temporarily making the affected editors read-only during rollback. Never restore
the database snapshot over subsequent user writes without an approved recovery plan.
