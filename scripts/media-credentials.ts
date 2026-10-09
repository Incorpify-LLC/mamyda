import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function key(material: string) {
  if (material.length < 32)
    throw new Error("Transcription credential protection is not configured");
  return createHash("sha256").update(`mamyda-media-v1:${material}`).digest();
}
export function sealMediaCredential(value: string, owner: string, material: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(material), iv);
  cipher.setAAD(Buffer.from(owner));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}
export function openMediaCredential(value: string, owner: string, material: string) {
  try {
    const [version, iv, tag, body] = value.split(".");
    if (version !== "v1" || !iv || !tag || !body) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key(material), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(owner));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Could not open transcription credentials; re-enter the API key in Settings → LLM",
    );
  }
}
