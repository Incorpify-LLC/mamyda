import { mkdir, writeFile, rename, rm, statfs } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export function mediaDirectory(id: string) {
  z.string().uuid().parse(id);
  return join(resolve(process.env.MEDIA_TEMP_DIR || "/tmp/mamyda-recordings"), id);
}
export const mediaDisk = {
  async putChunk(id: string, index: number, bytes: Uint8Array) {
    if (!Number.isInteger(index) || index < 0 || index >= 75)
      throw new Error("Invalid media chunk");
    const directory = mediaDirectory(id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const disk = await statfs(directory);
    if (disk.bavail * disk.bsize < 512 * 1024 * 1024)
      throw new Error("Temporary recording disk is full; try again later");
    const temporary = join(directory, `pending-${randomUUID()}`),
      target = join(directory, `chunk-${index}`);
    try {
      await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  },
  async remove(id: string) {
    await rm(mediaDirectory(id), { recursive: true, force: true });
  },
};
