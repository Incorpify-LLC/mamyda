/** Shared picker/server/worker allowlist. Explicit local demuxers prevent URL/playlist input. */
export const RECORDING_FORMATS = [
  { extension: "mp3", demuxer: "mp3", mime: "audio/mpeg" },
  { extension: "mp4", demuxer: "mov", mime: "video/mp4" },
  { extension: "wav", demuxer: "wav", mime: "audio/wav" },
  { extension: "m4a", demuxer: "mov", mime: "audio/mp4" },
  { extension: "webm", demuxer: "matroska", mime: "video/webm" },
  { extension: "ogg", demuxer: "ogg", mime: "audio/ogg" },
  { extension: "oga", demuxer: "ogg", mime: "audio/ogg" },
  { extension: "flac", demuxer: "flac", mime: "audio/flac" },
  { extension: "aac", demuxer: "aac", mime: "audio/aac" },
  { extension: "mov", demuxer: "mov", mime: "video/quicktime" },
] as const;

export const RECORDING_FORMAT_LABEL = "MP3, MP4, WAV, M4A, WebM, OGG/OGA, FLAC, AAC or MOV";
export const RECORDING_ACCEPT = [
  ...RECORDING_FORMATS.map((format) => `.${format.extension}`),
  ...new Set(RECORDING_FORMATS.map((format) => format.mime)),
  "audio/x-wav",
  "audio/webm",
].join(",");

export function recordingFormat(name: string) {
  if (!name.includes(".")) return undefined;
  const extension = name.split(".").pop()?.toLowerCase();
  return RECORDING_FORMATS.find((format) => format.extension === extension);
}
