# Vault storage operations

## Current infrastructure

pi06 MinIO is managed by systemd and listens on `127.0.0.1:9000`.
The dedicated `mamyda` bucket is private with versioning enabled. Policy
`mamyda-assets` allows bucket location/listing and GET/PUT/DELETE under `assets/`
only; it grants no administrator, other-bucket or historical-version deletion
permissions. The restricted `mamyda-vault` access key is in gitignored
`deploy/.env` as `VAULT_S3_ACCESS_KEY` / `VAULT_S3_SECRET_KEY`.

Do not deploy with the legacy LAN endpoint until reachability is fixed. Keep
`VAULT_S3_ENDPOINT` unset until the app has an approved persistent private path.
Use an encrypted SSH tunnel or TLS on a private network; do not publish the S3
API or console to solve a connectivity problem. The app container must be able
to reach the endpoint; host loopback is not the container's loopback.

## Integration smoke

Open a temporary tunnel in one terminal:

```bash
ssh -F /home/sanjayu/.ssh/config -o ExitOnForwardFailure=yes -N \
  -L 127.0.0.1:19060:127.0.0.1:9000 pi06
```

From the repository, in another terminal:

```bash
VAULT_SMOKE_ENDPOINT=http://127.0.0.1:19060 node scripts/vault-storage-smoke.mjs
```

This tests browser-compatible OpenPGP binary encryption, actual MinIO storage,
decryption and denial outside the allowed prefix. It writes only a random smoke
object under `assets/`, then deletes it. Versioning retains its encrypted prior
version by design. Stop the temporary tunnel with Ctrl+C afterwards.

## Application transfer contract

The new server functions reserve and finalize revisions and list/delete owned
assets. `PUT /api/vault/uploads/:id` accepts only a same-origin, session-owned,
unexpired reservation and `application/octet-stream` ciphertext. Its original
payload declaration is capped at 24 MiB; ciphertext has a separate 1 MiB framing
allowance. Actual length and digest must match the reserved values. Reservation
creation verifies Turnstile; transfer/finalization cannot reuse that token and
instead require the same authenticated owner and reservation state.

`GET /api/vault/assets/:id` returns only the current ready ciphertext with
private/no-store and nosniff headers. Metadata publication is atomic; pending
content stays hidden and an old revision remains readable while its replacement
is uploading. Delete tombstones hide assets but retain references on S3 failure.
Do not delete revision rows as an error-recovery shortcut.

These adapters are not yet wired into the writing/file editors. Existing upload
UI still uses its legacy 8 MB path. Before rollout add pending-upload quota and
scheduled orphan/retired-object cleanup, retaining metadata until storage deletion
succeeds. Expired reservations can be retired/replaced; that is not scheduled
cleanup or a substitute for a retention policy.

## Recovery gate before rollout

Versioning is not a backup. Choose a separate backup destination and retention
policy before enabling new user uploads. Back up PostgreSQL metadata, protected
key records and object versions together. Preserve bucket/object identifiers.
Restore into an isolated environment and verify an uploaded file, Note, Minutes
and legacy Vault note with the user's backup key. Do not purge legacy records or
object versions until the restore rehearsal passes and retention is approved.
Key/passphrase recovery cannot be replaced by a database restore alone.

After infrastructure setup, verify least-privilege denial, rotation, private
reachability, health checks and upload failure recovery. Never log secrets,
passphrases, signed URLs or decrypted content. Storage format helpers are not
authorization: all eventual HTTP handlers must resolve ownership themselves.
