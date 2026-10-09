# Asset ownership and optional encryption

## Product model

Clients/Projects manages names, contact details and project structure. Board contains
Tasks, Files, Minutes, Notes and Vault. A new asset must belong to an owned client
and a project under that client. Encryption is a separate choice, not a consequence
of selecting a project. Legacy unassigned assets remain accessible until reassigned.

Scope clarification: **Tasks are encryptable assets too**, not an exception. Both
individual-item and selected-batch encryption must be supported. Vault manages
the keys; encrypting an item does not move it out of its normal Board tab.
Each explicit opening operation requires a passphrase, including reopening after
lock. A batch may share a key, but selecting a batch must not implicitly decrypt it.

Confirmed privacy boundary for Tasks and Notes: encrypt only their content
(task description/notes and note body). Names/titles, dates and tags remain visible
and searchable while locked. Project/client associations, task status and priority
remain operational metadata, not encrypted content. This lets task reminders use
the visible name and due date without opening its private description. Server-side
search must never index decrypted content or ciphertext as searchable body text.
Never silently send private content to calendar, AI, email or Telegram integrations.

Vault is the key manager, not a second copy of every asset. Proposed flow:

1. Select client/project and create or upload the asset.
2. Choose **Not encrypted** or **Encrypt with…**. Explain what remains visible.
3. Choose a reusable workspace key or an independent client/project key.
4. Confirm recovery backup before first encryption; publish only a verified upload.
5. Encrypted rows show a lock, key label and **Unlock**. Prompt for the password
   explicitly for each asset; never decrypt on navigation, refresh or selection.
6. **Lock** removes plaintext previews, editor contents and decrypted key references.
   A dirty editor offers Save, Discard or Cancel before locking.

Task and note rows remain useful while locked: display their visible title, date,
tags and lock badge, but replace private content/previews with **Encrypted content —
Unlock to view**. Metadata-only changes must preserve the encrypted body unchanged.
Derive note titles and extract tags in the browser before encryption, or expose
dedicated name/tag inputs; the backend cannot derive them from an encrypted body.
Existing tag extraction must not cause the full decrypted body to be submitted.
Encrypted drafts must never enter the current plaintext writing-draft storage.

## Keys and passwords

A workspace key can serve multiple clients/projects. A client can have its own
default key, and a project can override it. Independent keys may use different
passwords or the same password; equal passwords do not make two keys interchangeable.
Changing a project default affects future encryption only, never silently changes
existing ciphertext. Every encrypted revision retains its actual key ID/fingerprint.

Store protected private keys, public keys, ownership, key labels and scope in a
keyring. Never send plaintext, passwords or unlocked private keys to the backend.
Metadata (names, size, associations, dates) remains readable by the application.
No password reset can recover ciphertext without the original key and password.

## Storage and rollout

Additive schema: asset ownership/type/client/project, `encryption_mode` (`none` or
`openpgp`), nullable key ID, format, revision and object reference. Private pi06
MinIO objects store either original bytes or ciphertext according to that mode.
PostgreSQL stores references. No public object URLs or automatic bulk migration.
Require ownership validation and Turnstile on mutating initiation; bound each
original file to 24 MiB. Switching encryption mode creates a new verified revision.

TDD sequence: keyring ownership/default precedence; association constraints;
optional plaintext/encrypted round trips; explicit password prompts and wrong-key
errors; lock/dirty-editor behavior; migration/retry/rollback; browser accessibility.
Cover Files (single and batch), Notes, Minutes and Tasks. Test that encrypted data
is absent from plaintext database fields, object contents, local storage, search
indexes and automatic calendar/AI/reminder paths. Existing plaintext items need
explicit, verified conversion, not an encryption badge over unchanged storage.

## Current implementation boundary

Multi-file uploads, progress, sorting and client/project-linked new files are
implemented. Files are **not Vault-encrypted**. Task descriptions and Note bodies
now support optional browser encryption using the existing workspace Vault key.
Ciphertext goes to the existing configured private S3 store; database body fields
are cleared and retain object references/fingerprints. Existing plaintext items
are converted only when the user explicitly chooses encryption and saves.
Explicit password-driven Unlock is required, and encrypted drafts never enter
browser draft storage. Previous backups are not retroactively erased.
Minutes retain their existing plaintext storage. Independent project keys,
file/Minutes encryption and legacy reassignment remain subsequent work; the UI
must not claim those features are live.
