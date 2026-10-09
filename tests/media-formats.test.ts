import { expect, test } from "vitest";
import { recordingFormat, RECORDING_ACCEPT } from "../scripts/media-formats";
import { recordingSelectionError, MAX_MEDIA_BYTES } from "@/lib/media-config";

test.each(["mp3", "mp4", "wav", "m4a", "webm", "ogg", "oga", "flac", "aac", "mov"])(
  "picker and decoder agree on %s",
  (extension) => {
    expect(recordingFormat(`meeting.${extension.toUpperCase()}`)?.extension).toBe(extension);
    expect(RECORDING_ACCEPT).toContain(`.${extension}`);
    expect(recordingSelectionError({ name: `meeting.${extension}`, size: 1024 })).toBeNull();
  },
);
test("invalid selections produce actionable errors instead of disappearing", () => {
  expect(recordingSelectionError({ name: "recording.exe", size: 10 })).toContain("supported");
  expect(recordingSelectionError({ name: "recording.wav", size: 0 })).toContain("empty");
  expect(recordingSelectionError({ name: "recording.wav", size: MAX_MEDIA_BYTES + 1 })).toContain(
    "300 MiB",
  );
  expect(recordingFormat("recording.wav.exe")).toBeUndefined();
  expect(recordingFormat("wav")).toBeUndefined();
});
