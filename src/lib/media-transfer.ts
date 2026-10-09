import { transferFile } from "@/lib/file-transfer";
import { MEDIA_CHUNK_BYTES } from "@/lib/media-config";
export async function transferRecording(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  startIndex = 0,
) {
  const count = Math.ceil(file.size / MEDIA_CHUNK_BYTES);
  for (let index = startIndex; index < count; index++) {
    const start = index * MEDIA_CHUNK_BYTES,
      end = Math.min(file.size, start + MEDIA_CHUNK_BYTES);
    const chunk = new File([file.slice(start, end)], file.name, {
      type: "application/octet-stream",
    });
    await transferFile(
      url,
      chunk,
      (percent) =>
        onProgress(
          Math.min(99, Math.round(((start + ((end - start) * percent) / 100) / file.size) * 100)),
        ),
      { "x-media-chunk": String(index) },
    );
    onProgress(index === count - 1 ? 100 : Math.min(99, Math.floor((end / file.size) * 100)));
  }
}
