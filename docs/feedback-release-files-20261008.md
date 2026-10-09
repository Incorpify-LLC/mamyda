# Files and Clients/Projects feedback release

Release: `board-files-feedback-20261008-2`, deployed to pi03 for user feedback.
Git changes are intentionally not committed or pushed pending review.

## Available

- Separate Clients/Projects navigation and client/project creation/editing.
- Board Files tab with required client/project selection for new uploads.
- Multiple selection: 1–20 files per batch, each at most 24 MiB.
- Real per-file transport progress, separate Saving/Uploaded states and retries.
- Sorting by name, extension, byte size and upload date; labelled legacy files.
- One server-verified Turnstile check per upload batch; protected file deletion.
- Vault no longer restores an unlocked key automatically. Opening each existing
  Vault note requires an explicit password prompt; Lock clears visible plaintext.

## Not yet available

Shared/client/project keyrings and optional encryption of Files/Notes/Minutes are
specified in `asset-encryption-model.md`, not implemented. New files use the
existing S3 configuration and are not Vault-encrypted. Legacy client-level files
are preserved, not automatically assigned or converted. Existing Vault notes
remain under the workspace key; no key rotation or data conversion was performed.
Expired upload records/object cleanup remains operational follow-up work.

## Verification and rollback

95 application tests pass; typecheck, changed-file lint and container build pass.
32 independent app-data/auth-identity tests pass. Desktop 1280px and mobile 390px
browser smoke tests: no page errors or page-level horizontal overflow.
Four legacy platform-script tests reference missing `.grok` skill documentation;
the full platform suite is not green. The dev auth-invariant script cannot validate
the deliberately auth-disabled isolated preview. Candidate upload API rejects
unauthenticated requests with 401. Real authenticated live uploads still need
user feedback; security checks were not bypassed to test them.

Migration `0008_file_upload_batches.sql` is additive and applied. Before cutover,
source/database backups were saved privately under
`/home/sanjayu/mamyda-rollbacks/board-files-feedback-20261008-1535/`.
Previous image: `mamyda-feedback-rollback:20261008-1535` (`ed06f9209398`).
New image: `497986eea1a7`. To roll back code, retag the previous image as
`mamyda_app:latest` and recreate only the app service; retain the additive schema.
Do not restore the database backup over new user writes without an approved plan.
No tunnel, MinIO listener, credential or unrelated-service changes were made.

## Product evaluation

The navigation now separates administration from daily work, and upload status
answers whether bytes are transferring or a record is actually saved. The next
priority is the keyring/encryption flow: an asset's project and its key must remain
separate concepts, with clear lock badges and an explicit password-driven Unlock.
