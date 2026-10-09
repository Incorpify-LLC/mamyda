import { test, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sealMediaCredential, openMediaCredential } from "../scripts/media-credentials";
let directory: string, worker: any;
const material = "test-media-secret-with-more-than-32-characters";
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "mamyda-media-test-"));
  vi.stubEnv("MEDIA_TEMP_DIR", directory);
  vi.stubEnv("BETTER_AUTH_SECRET", material);
  worker = await import("../scripts/media-worker.mjs");
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
test("transcription credentials are owner-bound and keys/errors are not returned", async () => {
  const cipher = sealMediaCredential("private-key", "alice", material);
  expect(cipher).not.toContain("private-key");
  expect(openMediaCredential(cipher, "alice", material)).toBe("private-key");
  expect(() => openMediaCredential(cipher, "bob", material)).toThrow("credentials");
  const fetcher = vi.fn(async () => new Response("private-key private recording", { status: 401 }));
  await expect(
    worker.transcribePart(new Uint8Array([1]), "whisper-1", "private-key", fetcher),
  ).rejects.toThrow("credentials");
});
test("unsupported model fails before any provider network call", async () => {
  const fetcher = vi.fn();
  await expect(
    worker.transcribePart(new Uint8Array([1]), "chat-only-model", "private-key", fetcher),
  ).rejects.toThrow("does not support speech-to-text");
  expect(fetcher).not.toHaveBeenCalled();
});
test("retention removes temporary media and clears transcript/credential records", async () => {
  const id = randomUUID();
  await mkdir(join(directory, id));
  await writeFile(join(directory, id, "recording.mp3"), "temporary");
  const query = vi.fn(async (text: string) => ({
    rows: text.startsWith("select") ? [{ id }] : [],
  }));
  await worker.expireMedia({ query });
  expect(await readdir(directory)).not.toContain(id);
  expect(query.mock.calls.some(([text]) => text.includes("transcript=''"))).toBe(true);
});
test.each(["mp3", "mp4", "wav", "m4a", "webm", "ogg", "oga", "flac", "aac", "mov"])(
  "real %s extraction populates a transcript using a mocked paid provider",
  async (ext) => {
    const id = randomUUID(),
      jobDir = join(directory, id);
    await mkdir(jobDir);
    const generated = join(directory, `synthetic-${id}.${ext}`);
    await promisify(execFile)(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        "-c:a",
        (
          {
            mp3: "libmp3lame",
            mp4: "aac",
            wav: "pcm_s16le",
            m4a: "aac",
            webm: "libopus",
            ogg: "libvorbis",
            oga: "libvorbis",
            flac: "flac",
            aac: "aac",
            mov: "aac",
          } as Record<string, string>
        )[ext],
        generated,
      ],
      { timeout: 10000 },
    );
    const bytes = await readFile(generated);
    await writeFile(join(jobDir, "chunk-0"), bytes);
    const fetcher = vi.fn(async () => Response.json({ text: "Meeting transcript." }));
    vi.stubGlobal("fetch", fetcher);
    const query = vi.fn(async () => ({ rows: [{ id }] }));
    await worker.processMediaJob(
      { query },
      {
        id,
        user_id: "alice",
        name: `meeting.${ext}`,
        next_chunk: 1,
        byte_size: bytes.length,
        api_key_cipher: sealMediaCredential("test-key", "alice", material),
        model: "gpt-transcribe",
      },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(
      query.mock.calls.some(
        (args: any[]) => args[0].includes("status='ready'") && args[1][1] === "Meeting transcript.",
      ),
    ).toBe(true);
    expect(await readdir(jobDir)).toContain(`recording.${ext}`);
    vi.unstubAllGlobals();
  },
);
test("corrupt WAV reports an explicit error before any paid request", async () => {
  const id = randomUUID(),
    jobDir = join(directory, id);
  await mkdir(jobDir);
  await writeFile(join(jobDir, "chunk-0"), "not a WAV recording");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    worker.processMediaJob(
      { query: vi.fn() },
      {
        id,
        user_id: "alice",
        name: "broken.wav",
        next_chunk: 1,
        byte_size: Buffer.byteLength("not a WAV recording"),
        model: "whisper-1",
        api_key_cipher: sealMediaCredential("test-key", "alice", material),
      },
    ),
  ).rejects.toThrow("valid supported recording");
  expect(fetcher).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
