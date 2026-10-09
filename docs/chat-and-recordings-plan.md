# Context chat and recording-to-minutes

## October 8 usability update

The chat workspace now uses a single composer, collapsed model/context controls,
and a Saved chats drawer. One shared Turnstile widget mounts only after Ask model
or Save chat is selected. Verification never submits automatically: consent and
**Ask Model now** are required. Each operation gets a fresh action-specific token.
Failures preserve the question, but require a new check before retrying.

New chats are saved without content encryption; existing encrypted archives are
read-only and still require their original Vault passphrase. Removing controls
does not decrypt, migrate, or overwrite earlier protected content.

Recordings support MP3, MP4, WAV, M4A, WebM, OGG/OGA, FLAC, AAC and MOV, subject to
FFmpeg decoder support and an audio stream. The limit remains 300 MiB/four hours.
Selection displays the filename and next steps; it does not start transcription.
Unsupported, empty and oversized files show visible errors. The worker probes
and decodes the correct container before any paid transcription request.

Verification: `npm run test:app`, `npm run typecheck`, `npm run build:container`.
For isolated browser checks, run
`npx vite --config tests/browser/vite.config.ts`, then
`node scripts/chat-ui-e2e.mjs`. Fixtures mock security/provider calls and never
upload a user's recording. The original acceptance criteria below describe the
earlier delivery; this update supersedes new-chat encryption and MP3/MP4-only input.

## Delivery order and acceptance criteria

1. **Plain-text edits:** send only the editable body; remove a recognized JSON
   metadata wrapper in provider responses. Reject malformed wrappers without
   changing the draft. Regression-test the reported task example.
2. **LLM Chat:** primary navigation; explicit task/note/minute/file selection with
   preview/removal. Ownership-checked reads, bounded text extraction, and no
   automatic corpus upload. Same configured provider credentials, per-request
   model ID and optional reasoning effort. Unsupported controls fail visibly.
3. **Daily archive:** one date-labelled transcript per user/day, manually saved;
   visible title/tags/date and revision conflict protection. Plain text searchable;
   optional browser encryption stores ciphertext in the private object store,
   clears plaintext/indexes and requires the Vault passphrase to open. Never put
   encrypted drafts/context in browser storage. Warn about external processing,
   recovery and older backups. No automatic decryption or downgrade to plaintext.
4. **Recordings:** accept MP3/MP4 up to 300 MiB in 4 MiB authenticated chunks with
   upload progress. Temporary private local volume only, never MinIO. Explicit
   consent, OpenAI transcription credential/model, queued processing and visible
   status/errors. FFmpeg extracts mono audio into provider-sized segments with
   bounded duration/time/resources; no remote media URLs. Review transcript before
   appending/replacing minutes; no automatic save. Explicit acceptance deletes
   originals and derived audio. Expire all media 15 days after creation regardless
   of status; keep the saved minutes. Run cleanup at startup and periodically.

## Verification and rollout

Tests must cover owner isolation, consent, model/effort forwarding, encrypted
search exclusion, passphrase-only reads, stale saves, malformed chat blobs, upload
size/chunk ordering, expiry and acceptance deletion, and sanitized provider errors.
Provider calls are mocked in tests (no charges). Live model access and transcription
accuracy require user feedback. Additive migrations, source/database backups and
an image rollback precede deployment; no Git push until reviewed.

Provider transcripts are external processing, not end-to-end Vault-private.
Transcription has separate API access requirements from a text/chat model. 300 MiB
is an upload ceiling, not unlimited recording length; default processing cap is
four hours. Chat file context initially supports text-based files; unsupported
binary formats must show an error rather than silently uploading raw bytes.
PDF/DOCX are locally extracted with bounded output/time; scanned or protected
PDFs need a readable text export. UTF-8 text is limited to 2 MiB, documents to
24 MiB, and all excerpts to 20,000 characters each.

## Implemented storage and operations

Plain daily chat blobs are stored in PostgreSQL and searched there. Encrypted
blobs are validated against the current Vault key and stored in private MinIO;
PostgreSQL keeps only a reference, fingerprint and visible metadata. Conversion
clears the live plaintext body. Old database backups are not retroactively erased.
Reopening always starts locked; unlocked contents/context stay in React memory.

Recording jobs and their metadata/transcripts live in PostgreSQL. Actual media,
upload chunks and derived audio use the `mamyda-recordings` local Docker volume,
shared only by the app and a resource-limited `media-worker`. No S3 upload occurs.
The worker uses a database singleton lock, processes one job at a time, checks
recording format/duration, converts 15-minute mono audio segments, and calls the
allowlisted OpenAI transcription API. Calls are not automatically retried. A
restart marks interrupted jobs failed because their billing outcome is uncertain.
Expired jobs are inaccessible immediately; filesystem cleanup runs at startup and
every minute. Provider retention is separate. Monitor the worker and disk, exclude
the media volume from long-term backups, and never restore expired recordings.

Users choose a dedicated speech-to-text model (separate from the chat model) and API
key in Settings → LLM. Only documented audio-transcription model IDs are selectable:
`gpt-transcribe`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `whisper-1`.
The diarization-only model is omitted because it requires a different response
format than this plain-text minutes workflow.
The app rejects unsupported IDs at settings save, before accepting an upload, and
again before the worker starts or sends a segment. This capability check cannot
guarantee a user’s key has provider access; a provider authorization error is shown
without automatic retries.
Users must configure a separate transcription API key in Settings → LLM.
Credentials are owner-bound AES-GCM ciphertext, not Vault-private. Removing or
disabling transcription blocks new jobs; already sent provider requests cannot be
recalled. Uploaded media can be discarded; ready transcripts can be marked OK
after saving minutes, with a separate permanent-deletion confirmation.
