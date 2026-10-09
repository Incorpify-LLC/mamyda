# Shared Speech-to-Text Service Plan

Status: proposed architecture; no installation or deployment in this planning task.
Date: 2026-10-08. First client: Mamyda. Standalone public repository:
[Incorpify-LLC/mamyda-stt](https://github.com/Incorpify-LLC/mamyda-stt), Apache 2.0.
The deployment-neutral architecture belongs in that repository; infrastructure
addresses and this hardware assessment remain in Mamyda's internal plan.

## Product and deployment decision

Build an independently deployed, versioned HTTP API, with a reusable pipeline core
and small client SDKs. Other projects integrate through the API; they do not need
to copy Mamyda code or install speech models. Model discovery, sample testing,
transcription, progress, review flags and deletion belong to the service.

Pi05 owns the API, durable queue, temporary media and preprocessing. Mamyda's
pi03 backend authenticates users and forwards streamed upload chunks and job
requests; it does not perform conversion or inference. Other applications use
their own service credentials and quotas.

Read-only inspection found pi05 is a Raspberry Pi 4 Model B, ARM64, four cores,
approximately 8 GiB RAM, 5.2 GiB available and 45 GiB free on an SD-card root
filesystem. Pi08 is also a four-core Pi 4, but has 4 GiB RAM, 2.2 GiB available,
17 GiB free and an existing Hindsight container. Pi05 has more headroom, not a
fundamentally different CPU class. A Node process already uses substantial memory
on pi05; budgets must preserve existing workloads. These are point-in-time
capacity snapshots, not throughput benchmarks.

Run one processing job at a time initially. Start with two CPU cores and a total
service memory budget around 1.5 GiB, subject to measured coexistence with the
existing workload. Use SSD-backed temporary storage before sustained large-file
use; frequent media writes and a 15-day retention window should not rely on the
remaining SD-card capacity alone. Admission checks reserve disk space and reject
new work clearly when the queue or storage budget is full.

## Processing pipeline

1. **Validate and inspect:** verify actual media/container format, byte size,
   duration, audio stream presence, selected provider readiness and limits. Reject
   unsupported models before accepting a full upload wherever capability metadata
   is available. Mamyda retains its 300 MiB/four-hour ceiling; each client can set
   a smaller ceiling. Do not download arbitrary media URLs.
2. **Extract:** select the appropriate speech channel and decode to 16 kHz,
   16-bit PCM audio. Preserve stereo channels when they represent separate
   speakers; indiscriminate downmixing can obscure speech. Keep the original
   until acceptance or expiry.
3. **Prepare:** offer `standard` (level adjustment and speech segmentation) and
   `enhanced` (additional measured noise reduction) profiles. Detect clipping,
   prolonged silence and noisy passages. More filtering is not necessarily
   better: severe denoising can remove words. Initially use bounded FFmpeg
   filters; make expensive neural enhancement an optional adapter, offloaded to
   the LAN inference host if pi05 cannot meet its resource budget.
4. **Segment:** use voice activity detection with speech padding and preserve
   original timestamps. Chunk according to the selected model's verified audio
   limits, with a small overlap where needed and explicit overlap deduplication.
   Do not assume the existing 15-minute cloud chunks fit every LAN model.
5. **Recognize:** send prepared audio to the chosen speech engine. Support local
   Whisper first and audio-capable Ollama models through their tested API
   contract. Record the engine/model/version and preprocessing profile used.
6. **Check and review:** run structural checks, flag repetitions, suspected
   hallucinations, missing passages and uncertain segments. Optionally request
   conservative LLM corrections or audio-based re-transcription of flagged
   segments. Keep the raw transcript and proposed edits separately.
7. **Return:** deliver raw text, reviewed text, timestamped segments, warnings,
   stage timings, model identity and review status. Clients decide whether to
   accept the transcript or request another explicit run.

An LLM reading text cannot prove that it matches the recording. Use status values
such as `checks_passed`, `needs_review` and `unverified`, rather than claiming
certified accuracy. Protect names, dates, numbers and quoted statements; changes
need a reason and a source segment. Never turn model scores into an unsupported
accuracy percentage. A failed optional verifier can leave a successful raw
transcript available with review status `unverified`.

## Engines and defaults

- **Pi05 local Whisper:** prefer `whisper.cpp` for the initial ARM CPU backend.
  Benchmark multilingual `base` first, then a quantized `small` candidate if the
  measured memory/latency permits it. Use multilingual models for Hindi/English
  recordings. Select the actual default after representative recordings pass
  quality and speed checks; do not promise real-time processing on a Pi 4.
- **LAN inference at 192.168.2.112:** keep provider adapters independent of the
  API node. Ollama currently advertises audio for `gemma4:e2b` and
  `gemma4:e4b`, but not `ministral-3:14b`. Audio-capable Gemma needs a successful
  normalized audio test. Ministral can be used for text review/minutes drafting.
  The earlier short synthetic tests are insufficient to rank these engines.
- **Larger Whisper service:** retain an adapter for faster-whisper on a suitable
  LAN CPU/GPU host if pi05's benchmark is too slow. Hosting the API on pi05 does
  not require every inference model to run on pi05.
- **Personal cloud or custom models:** clients choose from registered provider
  endpoints, supply their own encrypted credentials where needed, and test an
  exact model. Support both an audio-transcriptions endpoint and an audio-input
  chat endpoint through distinct adapters. Operator-controlled endpoint
  registration prevents user-entered URLs from accessing arbitrary LAN services.
  A new model needs capability validation and a real sample test; generic chat
  compatibility is insufficient.

No automatic fallback to a paid provider. A timeout or uncertain paid response
does not cause automatic repeat billing. Safe local preprocessing can resume;
external inference stages record whether submission occurred before retrying.

## API contract and reuse

Use `/v1` routes documented in OpenAPI. A Python API/worker can orchestrate
FFmpeg and whisper.cpp binaries; the pipeline and provider interfaces remain
importable modules. Ship TypeScript and Python clients for uploading, polling,
cancelling and retrieving results. Persist queue/job state in SQLite WAL initially
with transactional worker leases; keep a storage interface for future scale.

| Endpoint | Behavior |
| --- | --- |
| `GET /v1/models` | Engine availability, audio capability, limits, profiles and readiness |
| `POST /v1/tests` | Queued, short audio sample test; return transcript, timings and warnings |
| `POST /v1/uploads` | Reserve a bounded upload and return resumable chunk instructions |
| `PUT /v1/uploads/{id}/chunks/{index}` | Authenticate and acknowledge an ordered upload chunk |
| `POST /v1/uploads/{id}/complete` | Verify total bytes and inspect media before job creation |
| `POST /v1/transcriptions` | Submit upload ID/options; return HTTP 202 and job ID |
| `GET /v1/transcriptions/{id}` | State, stage, measured progress and errors |
| `GET /v1/transcriptions/{id}/result` | Transcript, segments, review changes and provenance |
| `DELETE /v1/transcriptions/{id}` | Cancel work and request owned media/result deletion |
| `GET /health/live`, `GET /health/ready` | Process liveness and queue/provider readiness |

Use idempotency keys for job creation and chunk acknowledgements. Progress reports
the actual stage (`uploading`, `queued`, `extracting`, `enhancing`, `transcribing`,
`reviewing`, `complete`, `failed`, `cancelled`), queue position and completed
segments. Estimated time remains unavailable until benchmarks support it.

Run behind authenticated HTTPS, initially reachable by approved application
backends on the LAN. Each application has a separate API key, quotas and tenant
namespace, with jobs bound to its supplied user identity. Service keys stay in
application backends. A later direct-browser upload option needs short-lived,
single-job upload tokens and explicit allowed origins. Human-facing clients keep
their Turnstile protection.

## Test-and-choose experience

Provide a small reusable settings UI in Mamyda first: choose engine/model and
preprocessing profile, then test a representative 10–30-second clip. Show original
and enhanced playback, transcript, elapsed time and review flags. Allow comparing
the same clip across choices. If reference text is supplied, calculate a named
reference-based word error metric; otherwise users judge the result directly.
Metadata capability checks are insufficient to label transcription quality good.

Testing requires an explicit submission, with clear local/cloud processing and
cloud charging information. Limit sample duration/bytes and concurrent tests.
Short-lived test results record the exact configuration; changing model/provider
invalidates readiness for that configuration. A sample success proves the path
works, not that every language or future recording will be accurate.

## Data lifecycle and operations

Keep originals, extracted audio and enhancement intermediates in private local
service storage on pi05; Mamyda's recording media does not go to MinIO. Store
transcripts/results only for delivery and the agreed review window. Mamyda requests
15-day maximum retention and earlier deletion after acceptance; other projects
may request shorter retention. Expired objects become inaccessible immediately,
with deletion at startup and recurring cleanup, including derived/test files.
Exclude media from backups. After delivery, Mamyda owns saving/encrypting minutes
according to its existing Vault workflow.

Use resource-limited containers, bounded subprocess execution, one initial worker,
queue backpressure and graceful cancellation. Log identifiers, stages and timing,
not recordings, transcripts, keys or passphrases. Monitor free disk, oldest queued
job, processing speed, worker health, expiry cleanup and provider errors. Version
models/configuration and keep rollback images and database schema backups.

## Implementation sequence and acceptance

1. **Benchmark and contract:** finalize OpenAPI/job states and representative
   clean/noisy/mixed-language fixtures. Measure pi05 CPU/RAM/temperature, Whisper
   speed and normalized Gemma outputs. Select the initial engine and queue limits.
2. **Standalone foundation:** implement project authentication, resumable uploads,
   durable queue, inspection, cancellation, retention and failure recovery with
   contract/security tests. Deploy a private candidate on pi05.
3. **Audio pipeline:** test extraction, profile selection, segmentation/timestamp
   preservation and local Whisper. Verify noise reduction helps on measured
   fixtures before recommending the enhanced profile.
4. **Providers and verification:** add LAN Ollama/cloud/custom adapters, capability
   rejection, bounded output, no repeat billing and conservative LLM review with
   adversarial tests for invented words, numbers and missing speech.
5. **Sample UI and Mamyda integration:** add client SDK and test-and-choose UI,
   route new recording work to pi05, and drain the old pi03 worker before removing
   it. Test long upload progress, tenant isolation, outages, expiry and accepted
   media deletion. Then onboard a second project to prove reuse.

Release only when real short/long recordings show acceptable transcription,
pi05 stays within its resource budget, a restart resumes/reports jobs safely,
no media crosses tenant boundaries, and every expired or accepted media variant
is removed. The user authorized creation and initial publication of the separate public
repository. Mamyda application changes retain the current feedback review workflow.

## Primary references

- [whisper.cpp: CPU inference, Raspberry Pi support, VAD, quantization and PCM input](https://github.com/ggml-org/whisper.cpp)
- [faster-whisper: CPU/GPU execution, quantization, benchmarks and VAD](https://github.com/SYSTRAN/faster-whisper)
- [FFmpeg audio filters](https://ffmpeg.org/ffmpeg-filters.html)
- [Ollama Gemma 4 model capabilities](https://ollama.com/library/gemma4)
