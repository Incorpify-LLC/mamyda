# Chat and recording usability feedback release

Release: `chat-recordings-feedback-20261009-8`.
Live site: https://mamyda.incorpify.in. Image: `590a054e0890` (ARM64, Node 24).
Deployed to the existing pi03 app and media-worker without a Git commit or push.
Existing authentication, Turnstile configuration, secrets, storage and tunnel
were preserved. No schema changes were required.

## Changes

- Single-column chat composer; model/context options collapsed and saved chats
  in a drawer. One shared security widget mounts only on Ask model/Save chat.
  Verification never submits automatically; asking needs consent and explicit
  **Ask Model now** confirmation. Errors retain the question and require a fresh
  security check. Cancelled/expired tokens cannot submit.
- New chat encryption controls removed. Earlier encrypted archives are read-only
  and remain locked until the original passphrase is supplied. No plaintext
  conversion or automatic decryption occurred.
- Recording picker, server and worker agree on MP3, MP4, WAV, M4A, WebM, OGG/OGA,
  FLAC, AAC and MOV. Correct demuxer, audio-stream validation, visible selection
  and errors. Existing 300 MiB/four-hour limits, upload progress, permission,
  configured STT model and 15-day temporary-media cleanup remain.
- Container packaging includes the new shared recording-format module.

## Verification

159 application tests, TypeScript and isolated browser checks passed again before
deployment. ARM64 Docker build, separate candidate health check, deployed worker
module import and native FFmpeg WAV probing passed. No queued/processing recording
was interrupted. No user recording was uploaded and no paid model was called.

Public smoke checks: expected release and healthy database connection; anonymous
recording PUT rejected with 401; OTP request without CAPTCHA rejected; protected
routes show sign-in, one real managed widget, no application errors/failed assets
or horizontal overflow at desktop/mobile widths. Run
`node scripts/chat-live-smoke.mjs` to repeat. Signed-in live chat/WAV submission
still requires the user's OTP-assisted session; fixture coverage is not a claim
of authenticated production end-to-end verification.

## Rollback

Private source and database snapshots are on pi03 under
`/home/sanjayu/mamyda-rollbacks/chat-recordings-feedback-20261009-8/`.
Previous images are tagged `mamyda-feedback-rollback:20261009-8-app` and
`mamyda-feedback-rollback:20261009-8-worker`.

If rollback is authorized, retag those images as `mamyda_app:latest` and
`mamyda_media-worker:latest`, check the recording queue has drained, and recreate
only app/media-worker using `docker-compose up -d --no-deps app media-worker`.
Do not restore the database merely to roll back code; that discards newer data.

The two task-created local Vite servers (ports 8080/8082) were stopped after
testing. The pre-existing local preview was left running.
