# Board and encrypted asset storage

## Product contract

**Updated requirement:** encryption is optional and project association is separate
from key selection. [Asset encryption model](asset-encryption-model.md) supersedes
the mandatory-encryption and single-key assumptions below; those paragraphs remain
as historical implementation context, not the current product contract.

Board becomes the workspace for Tasks, Minutes, Notes and Vault (all assets).
Every tab preserves the selected client/project; an All projects view includes
unlinked assets. Existing `/notes`, `/minutes`, `/vault` and search links remain
usable during rollout. Calendar-linked minutes keep their event association.

All new asset bodies and uploaded files are encrypted in the browser using the
existing user's OpenPGP public key. pi06 stores ciphertext in a dedicated private
`mamyda` bucket; PostgreSQL holds ownership, associations and object references.
Unlock means decrypting an asset locally, never making the stored object public
or plaintext. One unlocked vault key can open individual assets; Lock all clears
the key and every plaintext preview/editor. Passphrases and decrypted keys never
leave the browser. Losing both the backup key and passphrase is unrecoverable.

Initial metadata (title, type, filename, size, associations and timestamps) remains
visible to the application, as today; explain this limitation explicitly. Bodies,
attendees and file bytes are private. Collaboration/key sharing is out of scope;
existing owner-only authorization remains. A locked dirty editor must offer Save,
Discard or Cancel, not silently lose work. Disable plaintext sessionStorage drafts
for encrypted assets. Best-effort memory cleanup cannot guarantee zeroization in JS.

## Storage and upload design

- Limit original uploads to **24 MiB (25,165,824 bytes)**, labelled clearly in UI;
  validate before reading/encryption and again on the server. Ciphertext overhead
  has a separate bounded limit. No base64 file transport.
- Versioned binary OpenPGP payloads use immutable random object keys. The database
  stores bucket, key, encryption format, key fingerprint, ciphertext digest/size,
  original size/type, revision and pending/ready/deleting state. A JSON encrypted
  payload carries writing content; arbitrary files use binary payloads.
- Authenticated, ownership-checked, Turnstile-protected upload reservation issues
  a short-lived signed POST with a size policy (or bounded streaming app proxy).
  Verify MinIO POST-policy support before choosing the direct-upload path.
  Finalization checks the actual object size/digest and reservation, then publishes
  the DB reference with optimistic concurrency. Retries are idempotent; readers
  only see ready revisions. Expired pending objects and retired revisions need
  cleanup. Delete uses retryable tombstones; storage errors never erase the DB link.
- Keep MinIO off the public network by default, as deployment guidance requires.
  Use an app streaming proxy unless a narrowly routed HTTPS S3 data endpoint is
  explicitly approved. Direct browser transfer requires reachable TLS, exact-origin
  CORS, short-lived capability URLs and log redaction. Never expose the console.
- Provision `mamyda` only after resolving pi06's endpoint/account. Use a dedicated
  bucket-scoped service identity, private policy, TLS, versioning and independent
  backups. Bucket encryption via KMS is defense-in-depth, not a substitute for
  browser encryption. Back up both DB metadata and objects and rehearse restore.

## Migration and integrations

Add schema without modifying applied migrations. Keep legacy readers intact.
After key setup/unlock, migrate plaintext Notes/Minutes/files in the browser and
move existing Vault ciphertext unchanged. Verify object upload and decrypted
round-trip before switching references; retain originals until backup/restore
verification and explicit retention approval. Resumable migration tracks each
record and must never overwrite newer edits. Clearly label legacy unencrypted
assets until converted; do not claim encryption during partial migration.

Search indexes metadata only on the server; decrypted body search stays local.
Exports require unlocking and warn about plaintext downloads. AI minutes polishing
requires explicit consent to send selected decrypted content to the provider.
Calendar sync must not silently publish private minutes. Access checks apply to
every reservation, finalization, read, association change, export and deletion.

## Ordered issues

Published as [#11](https://github.com/Incorpify-LLC/mamyda/issues/11)
through [#16](https://github.com/Incorpify-LLC/mamyda/issues/16), respectively.

### 1. Binary encryption and asset format foundation

Extend existing OpenPGP helpers without breaking legacy notes. Add shared size and
format contracts. TDD: binary round-trip (including zero bytes/non-UTF8), wrong key,
tamper rejection, empty/24 MiB/over-limit validation. No live data changes.

### 2. Provision pi06 bucket and bounded authenticated storage

Depends on 1. Create private `mamyda`, scoped identity and backup runbook; implement
reservation/transfer/finalize/read/delete. TDD: unauthorized IDs, oversize and
truncated objects, expired/replayed reservations, failed S3/DB calls, idempotent
retry and concurrent revisions. Verify real MinIO integration, TLS and restore.

### 3. Unified asset schema and safe legacy migration

Depends on 1–2. Add metadata/object revision tables and owned client/project/event
associations. TDD: fresh and existing DB migration, interrupted conversion,
wrong keys, duplicate retry, revision conflicts, retention and legacy readability.

### 4. Encrypted files, Notes and Minutes with per-asset locking

Depends on 1–3. Upload/download progress, 24 MiB limit, retry/cancel, individual
lock/unlock plus Lock all; key setup/backup recovery UX. TDD: plaintext never sent
to storage or persisted as drafts, lock removes previews/object URLs, dirty lock
choices, reload/logout clears access, wrong-passphrase recovery and mobile forms.

### 5. Board navigation and contextual asset workspace

Depends on 3–4. Add Tasks/Minutes/Notes/Vault tabs, preserved context, filters,
empty states and accessible actions. TDD: deep links, browser back/forward,
project changes, All projects/unlinked items, keyboard and mobile navigation.

### 6. Private search, exports, AI consent and rollout verification

Depends on 2–5. Update global search/export/integrations and operational docs.
TDD: locked content unavailable, metadata results resolve correct assets,
explicit AI consent, full backup/restore and authorized end-to-end workflows.
Roll out behind a flag; enable only after staging migration and restore succeed.

## Execution status (2026-10-08)

Network access is restored and all six GitHub issues are published. The existing
empty `mamyda` bucket on pi06 was verified private; versioning is now enabled.
The `mamyda-assets` policy and `mamyda-vault` restricted service credential are
created. Credentials are saved only in gitignored `deploy/.env`; the Vault
endpoint is deliberately unset until persistent private routing is configured.
No existing credentials or legacy readers were replaced.

Issue 1 implementation: shared versioned binary format and original-size contract
plus OpenPGP byte encryption/decryption helpers are added. Tests were written and
failed before implementation, then passed for invalid sizes, binary round-trip,
tampering, wrong keys and the exact 24 MiB boundary. Legacy Vault tests still pass.
These helpers are not yet connected to live uploads; the existing 8 MB upload
path remains until issue 2 supplies bounded transfer and finalization.

Issue 2 is in progress: bounded ciphertext consumption and actual-byte digest
verification have passing failure-path tests. A real MinIO encrypted round-trip
and forbidden-prefix denial passed over an ephemeral SSH tunnel. The test object
was deleted; versioning intentionally retains the encrypted historical version.
MinIO listens on pi06 loopback only; the legacy LAN S3 endpoint in `.env` does
not match that listener. No listener, firewall or public tunnel was changed.
The next development step adds reservations, authenticated HTTP handlers and DB
state transitions; persistent networking and restore rehearsal remain rollout gates.

Follow-up implementation: migration `0007_vault_assets.sql` adds owner-scoped
assets and immutable upload/revision references without touching legacy tables.
The request workflow now supports reservation, bounded binary transfer,
actual-byte verification, atomic publication, revision checking, owner-only reads
and retryable deletion tombstones. Key fingerprints are checked against the
owner's configured public key. New reservations/deletions use the existing
server-side Turnstile gate; transfer/finalization continue the owner-bound,
expiring reservation rather than replaying its single-use token.

Board navigation now groups Tasks, Minutes, Notes and Vault, preserving legacy
URLs and client/project context. Notes/Minutes lists honor that context; new
writing inherits the selected project. Desktop/mobile browser smoke and dark
theme toggle passed after hydration, with no application errors or overflow.
These are navigation and backend foundations: encrypted writing/file editors,
per-asset locking, legacy conversion, search/export integration and deployment
are not complete. The feedback deployment subsequently applied migration 0007
without converting legacy data; the new storage endpoint remains disabled.
See `docs/feedback-release-20261008.md` for deployment and rollback details.
All 86 application tests and typecheck pass; container build
passes. Changed-file lint has no errors and the existing AppShell refresh warning.

## References

[OpenPGP.js binary encryption](https://docs.openpgpjs.org/),
[MinIO TLS](https://min.io/docs/minio/linux/operations/network-encryption.html),
[MinIO server-side encryption](https://min.io/docs/minio/linux/administration/server-side-encryption.html).
