import { test, expect, vi } from "vitest";
import { transferRecording } from "@/lib/media-transfer";
import { transferFile } from "@/lib/file-transfer";
vi.mock("@/lib/file-transfer", () => ({
  transferFile: vi.fn(async (_url: string, _file: File, progress: (value: number) => void) => {
    progress(100);
  }),
}));
test("recording progress reaches 100 only after every chunk is acknowledged", async () => {
  const progress: number[] = [];
  const file = new File([new Uint8Array(4 * 1024 * 1024 + 10)], "audio.mp3");
  await transferRecording("/upload", file, (value) => progress.push(value));
  expect(progress.slice(0, -1).every((value) => value < 100)).toBe(true);
  expect(progress.at(-1)).toBe(100);
  expect(vi.mocked(transferFile).mock.calls).toHaveLength(2);
  expect(vi.mocked(transferFile).mock.calls[1][3]).toEqual({ "x-media-chunk": "1" });
});
