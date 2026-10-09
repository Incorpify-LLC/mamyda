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
  return [];
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
