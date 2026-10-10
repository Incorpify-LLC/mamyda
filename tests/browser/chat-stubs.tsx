// Only the isolated UI fixture imports these; production routes do not.
export async function turnstileSiteKey() {
  return "1x00000000000000000000AA";
}
export function UserButton() {
  return <span className="text-sm text-muted-foreground">Test account</span>;
}
export function GlobalSearch() {
  return <span className="text-sm text-muted-foreground">Search workspace</span>;
}
export async function getTranscriptionSettings() {
  return { enabled: false, hasKey: false, model: "fixture-stt" };
}
export async function listMediaJobs() {
  const state = new URLSearchParams(window.location.search).get("state");
  if (state === "loading") return new Promise<never>(() => {});
  if (state === "error") throw new Error("Fixture recording query failure");
  if (state === "ready" || state === "processing")
    return [
      {
        id: "fixture-job",
        name: "Fixture meeting.wav",
        byte_size: 1024,
        status: state,
        transcript: "Fixture transcript; no provider call.",
        error: null,
        progress: 42,
        created_at: "2026-10-09",
        expires_at: "2026-10-24",
        next_chunk: 0,
        uploaded_bytes: 1024,
      },
    ];
  return [];
}
export async function getPrivateContent() {
  throw new Error("Decryption is disabled in this fixture");
}
export async function reserveMediaUpload() {
  throw new Error("Uploads are disabled in the UI fixture");
}
export async function acceptMediaTranscript() {
  throw new Error("No fixture transcript");
}
export async function discardMediaRecording() {
  throw new Error("No fixture recording");
}
export async function upsertClient(input: unknown) {
  const fixture = window as unknown as {
    __verificationQA: { calls: unknown[]; failNext: boolean };
  };
  fixture.__verificationQA.calls.push(input);
  if (fixture.__verificationQA.failNext) {
    fixture.__verificationQA.failNext = false;
    throw new Error("Fixture save failure. Your draft is unchanged.");
  }
  return { ok: true };
}
export const upsertProject = upsertClient;
export const archiveClient = upsertClient;
export const archiveProject = upsertClient;
export async function updateProfile() { throw new Error("Profile writes disabled in fixture"); }
export async function clearSampleData() { throw new Error("Sample deletion disabled in fixture"); }
