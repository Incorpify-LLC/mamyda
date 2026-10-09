import { recordingFormat, RECORDING_FORMAT_LABEL } from "../../scripts/media-formats";
export const MAX_MEDIA_BYTES = 300 * 1024 * 1024;
export const MEDIA_CHUNK_BYTES = 4 * 1024 * 1024;

export function recordingSelectionError(file: { name: string; size: number }): string | null {
  if (!recordingFormat(file.name))
    return `File type not supported. Choose ${RECORDING_FORMAT_LABEL}.`;
  if (!Number.isInteger(file.size) || file.size <= 0)
    return "This recording is empty. Choose a file containing audio.";
  if (file.size > MAX_MEDIA_BYTES)
    return "This recording is too large. Choose a file up to 300 MiB.";
  return null;
}
