import { Pool } from "pg";
import { mkdir, readFile, appendFile, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { openMediaCredential } from "./media-credentials.ts";
import { assertSpeechToTextModel } from "./speech-models.ts";
import { recordingFormat } from "./media-formats.ts";
const run = promisify(execFile);
const root = resolve(process.env.MEDIA_TEMP_DIR || "/tmp/mamyda-recordings");
export function jobDirectory(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid recording ID");
  return join(root, id);
}
export async function expireMedia(
  pool,
  diskRemove = (id) => rm(jobDirectory(id), { recursive: true, force: true }),
) {
  const { rows } = await pool.query(
    "select id from media_jobs where expires_at<=now() and status<>'expired' limit 100",
  );
  for (const row of rows) {
    await diskRemove(row.id);
    await pool.query(
      "update media_jobs set status='expired',transcript='',api_key_cipher=null,error=null,updated_at=now() where id=$1 and expires_at<=now()",
      [row.id],
    );
  }
  await pool.query("delete from llm_usage_windows where window_start<now()-interval '2 days'");
}
export async function transcribePart(bytes, model, key, fetcher = fetch) {
  assertSpeechToTextModel(model);
  if (bytes.length > 24 * 1024 * 1024)
    throw new Error("Converted audio segment exceeds provider limit");
  const form = new FormData();
  form.append("model", model);
  form.append("response_format", "json");
  form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "segment.mp3");
  let response;
  try {
    response = await fetcher("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new Error(
      "Transcription connection timed out. Re-upload to retry; no automatic paid retries.",
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Transcription API credentials or model access were rejected"
        : response.status === 429
          ? "Transcription API rate/credit limit reached"
          : "Transcription provider rejected the recording/model",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned no transcript");
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.length;
      if (length > 1000000) throw new Error("Transcript response exceeds limit");
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Provider returned an invalid transcript");
  }
  if (typeof data.text !== "string" || !data.text.trim())
    throw new Error("No speech text returned for this audio segment");
  return data.text.trim();
}
export async function processMediaJob(pool, job) {
  // Recheck persisted jobs before reading/converting files or making a paid provider request.
  assertSpeechToTextModel(job.model);
  const format = recordingFormat(job.name);
  if (!format) throw new Error("Recording file type is not supported");
  const directory = jobDirectory(job.id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const ext = format.extension,
    input = join(directory, `recording.${ext}`);
  await rm(input, { force: true });
  for (let index = 0; index < job.next_chunk; index++) {
    const chunk = await readFile(join(directory, `chunk-${index}`));
    const expected = Math.min(4 * 1024 * 1024, job.byte_size - index * 4 * 1024 * 1024);
    if (chunk.length !== expected) throw new Error("Recording chunks are incomplete; upload again");
    await appendFile(input, chunk, { mode: 0o600 });
    await rm(join(directory, `chunk-${index}`));
  }
  if ((await stat(input)).size !== job.byte_size) throw new Error("Recording size mismatch");
  let duration;
  try {
    const probe = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        format.demuxer,
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        input,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    const inspected = JSON.parse(probe.stdout);
    if (!inspected.streams?.some((stream) => stream.codec_type === "audio"))
      throw new Error("No audio stream");
    duration = Number(inspected.format?.duration);
  } catch {
    throw new Error(
      "Could not read this recording. It must be a valid supported recording with audio.",
    );
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 4 * 60 * 60)
    throw new Error("Recording must contain audio and be no longer than four hours");
  const output = join(directory, "segment-%03d.mp3");
  try {
    await run(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        format.demuxer,
        "-i",
        input,
        "-threads",
        "1",
        "-vn",
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "32k",
        "-f",
        "segment",
        "-segment_time",
        "900",
        "-reset_timestamps",
        "1",
        "-t",
        "14400",
        output,
      ],
      { timeout: 600000, maxBuffer: 1024 * 1024 },
    );
  } catch {
    throw new Error("Audio extraction failed or exceeded its processing limit");
  }
  const material =
    process.env.LLM_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "";
  const key = openMediaCredential(job.api_key_cipher, job.user_id, material);
  const files = (await readdir(directory))
    .filter((name) => /^segment-\d{3}\.mp3$/.test(name))
    .sort();
  if (!files.length || files.length > 17) throw new Error("No usable audio segments");
  const transcript = [];
  let characters = 0;
  for (let index = 0; index < files.length; index++) {
    const check = await pool.query(
      "select id from media_jobs where id=$1 and status='processing' and expires_at>now() and exists(select 1 from transcription_settings where user_id=$2 and enabled=true)",
      [job.id, job.user_id],
    );
    if (!check.rows[0])
      throw new Error("Recording expired, was cancelled, or transcription was disabled");
    const text = await transcribePart(
      await readFile(join(directory, files[index])),
      job.model,
      key,
    );
    characters += text.length;
    if (characters > 90000)
      throw new Error("Transcript exceeds the minutes text limit; split the recording");
    transcript.push(text);
    await pool.query(
      "update media_jobs set progress=$2,updated_at=now() where id=$1 and status='processing'",
      [job.id, Math.round(((index + 1) / files.length) * 100)],
    );
  }
  await pool.query(
    "update media_jobs set status='ready',transcript=$2,api_key_cipher=null,error=null,progress=100,updated_at=now() where id=$1 and status='processing' and expires_at>now()",
    [job.id, transcript.join("\n\n")],
  );
}
export async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const lock = await pool.connect();
  const acquired = await lock.query("select pg_try_advisory_lock(9462701) as acquired");
  if (!acquired.rows[0]?.acquired) {
    lock.release();
    await pool.end();
    throw new Error("Another recording worker is already running");
  }
  // A crashed paid request has uncertain billing. Never automatically retry it.
  await pool.query(
    "update media_jobs set status='error',api_key_cipher=null,error='Processing was interrupted. Re-upload to retry; paid calls are never automatically repeated.' where status='processing'",
  );
  let cleanupRunning = false;
  async function cleanup() {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      await expireMedia(pool);
    } catch {
      console.error("[media] Retention cleanup failed; retrying shortly");
    } finally {
      cleanupRunning = false;
    }
  }
  await cleanup();
  const timer = setInterval(() => void cleanup(), 60000);
  let stop = false;
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      stop = true;
      clearInterval(timer);
    });
  try {
    while (!stop) {
      const { rows } = await pool.query(
        "with next as (select id from media_jobs where status='queued' and expires_at>now() order by created_at for update skip locked limit 1) update media_jobs set status='processing',started_at=now(),updated_at=now() where id=(select id from next) returning *",
      );
      if (!rows[0]) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      try {
        await processMediaJob(pool, rows[0]);
        console.info("[media] Recording conversion finished");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Recording conversion failed";
        await pool.query(
          "update media_jobs set status='error',api_key_cipher=null,error=$2,updated_at=now() where id=$1 and status='processing'",
          [rows[0].id, message],
        );
        console.error("[media] Recording conversion failed; inspect the private job status");
      }
    }
  } finally {
    clearInterval(timer);
    await lock.query("select pg_advisory_unlock(9462701)");
    lock.release();
    await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error("[media] Worker stopped; check database/configuration");
    process.exit(1);
  });
