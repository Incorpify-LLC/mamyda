import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Sql } from "@/lib/db";
import { MAX_MEDIA_BYTES, MEDIA_CHUNK_BYTES, recordingSelectionError } from "@/lib/media-config";
import { readBoundedCipher } from "./vault-storage.server";
import { sealMediaCredential } from "../../../scripts/media-credentials";
import { assertSpeechToTextModel } from "../../../scripts/speech-models";
export type MediaJob = {
  id: string;
  name: string;
  byte_size: number;
  status: string;
  transcript: string;
  error: string | null;
  progress: number;
  created_at: string;
  expires_at: string;
  next_chunk: number;
  uploaded_bytes: number;
};
export function createMediaService(
  sql: Sql,
  guard: (action: string) => Promise<void>,
  disk: {
    putChunk(id: string, index: number, bytes: Uint8Array): Promise<void>;
    remove(id: string): Promise<void>;
  },
  credential: (owner: string) => Promise<{ model: string; cipher: string }>,
) {
  return {
    async reserve(owner: string, raw: unknown) {
      const data = z
        .object({
          name: z.string().min(1).max(200),
          size: z.number().int().min(1).max(MAX_MEDIA_BYTES),
          consent: z.literal(true),
        })
        .strict()
        .parse(raw);
      const name = data.name
        .split(/[/\\]/)
        .pop()!
        .replace(/[\r\n]/g, "_");
      const selectionError = recordingSelectionError({ name, size: data.size });
      if (selectionError) throw new Error(selectionError);
      const config = await credential(owner);
      assertSpeechToTextModel(config.model);
      await guard("media-upload");
      const id = randomUUID();
      const rows = await sql<{
        id: string;
      }>`insert into media_jobs(id,user_id,name,byte_size,model,api_key_cipher) select ${id},${owner},${name},${data.size},${config.model},${config.cipher} where (select count(*) from media_jobs where user_id=${owner} and status not in ('accepted','expired') and expires_at>now())<5 and (select count(*) from media_jobs where status not in ('accepted','expired') and expires_at>now())<30 returning id`;
      if (!rows[0])
        throw new Error("Temporary recording queue is full; accept/delete old recordings first");
      return { id, name, chunkBytes: MEDIA_CHUNK_BYTES, url: `/api/media/uploads/${id}` };
    },
    async list(owner: string) {
      return sql<MediaJob>`select id,name,byte_size,status,case when status='ready' then transcript else '' end as transcript,error,progress,created_at::text,expires_at::text,next_chunk,uploaded_bytes from media_jobs where user_id=${owner} and expires_at>now() order by created_at desc limit 30`;
    },
    async upload(owner: string, id: string, index: number, stream: AsyncIterable<Uint8Array>) {
      z.string().uuid().parse(id);
      z.number().int().min(0).max(74).parse(index);
      const row = (
        await sql<MediaJob>`select id,byte_size,status,next_chunk,uploaded_bytes from media_jobs where id=${id} and user_id=${owner} and expires_at>now()`
      )[0];
      if (!row) throw new Error("Recording upload not found or expired");
      const token = randomUUID();
      const claimed =
        await sql`update media_jobs set upload_lock=${token},upload_lock_at=now() where id=${id} and user_id=${owner} and status='uploading' and next_chunk=${index} and expires_at>now() and (upload_lock is null or upload_lock_at<now()-interval '5 minutes') returning id`;
      if (!claimed[0]) throw new Error("Chunk is out of order or upload already in progress");
      try {
        const expected = Math.min(MEDIA_CHUNK_BYTES, row.byte_size - index * MEDIA_CHUNK_BYTES);
        if (expected <= 0) throw new Error("Invalid chunk offset");
        const bytes = await readBoundedCipher(stream, expected);
        await disk.putChunk(id, index, bytes);
        const changed =
          await sql`update media_jobs set uploaded_bytes=uploaded_bytes+${expected},next_chunk=next_chunk+1,upload_lock=null,upload_lock_at=null,status=case when uploaded_bytes+${expected}=byte_size then 'queued' else 'uploading' end,updated_at=now() where id=${id} and user_id=${owner} and upload_lock=${token} and expires_at>now() returning id`;
        if (!changed[0]) throw new Error("Recording expired before completing upload");
      } catch (error) {
        await sql`update media_jobs set upload_lock=null,upload_lock_at=null where id=${id} and user_id=${owner} and upload_lock=${token}`;
        throw error;
      }
    },
    async accept(owner: string, id: string) {
      z.string().uuid().parse(id);
      await guard("media-accept");
      const row = (
        await sql`update media_jobs set status='deleting' where id=${id} and user_id=${owner} and status='ready' and expires_at>now() returning id`
      )[0];
      if (!row) throw new Error("Ready recording not found");
      await disk.remove(id);
      await sql`update media_jobs set status='accepted',transcript='',api_key_cipher=null,error=null,updated_at=now() where id=${id} and user_id=${owner} and status='deleting'`;
      return { ok: true };
    },
    async discard(owner: string, id: string) {
      z.string().uuid().parse(id);
      await guard("media-delete");
      const rows =
        await sql`update media_jobs set status='deleting',updated_at=now() where id=${id} and user_id=${owner} and status in ('uploading','queued','ready','error','deleting') and upload_lock is null returning id`;
      if (!rows[0])
        throw new Error("Recording cannot be removed while processing; wait for conversion");
      await disk.remove(id);
      await sql`update media_jobs set status='accepted',transcript='',api_key_cipher=null,error=null,updated_at=now() where id=${id} and user_id=${owner} and status='deleting'`;
      return { ok: true };
    },
  };
}
export function createTranscriptionSettings(
  sql: Sql,
  guard: (action: string) => Promise<void>,
  material = process.env.LLM_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "",
) {
  return {
    async metadata(owner: string) {
      const row = (
        await sql<{
          model: string;
          enabled: boolean;
          api_key_cipher: string | null;
        }>`select model,enabled,api_key_cipher from transcription_settings where user_id=${owner}`
      )[0];
      return {
        model: row?.model ?? "gpt-transcribe",
        enabled: row?.enabled ?? false,
        hasKey: Boolean(row?.api_key_cipher),
      };
    },
    async save(owner: string, raw: unknown) {
      const data = z
        .object({
          model: z
            .string()
            .trim()
            .min(1)
            .max(120)
            .regex(/^[\w./:@+-]+$/),
          enabled: z.boolean(),
          apiKey: z.string().trim().max(1000).optional(),
          clearKey: z.boolean().default(false),
        })
        .strict()
        .parse(raw);
      if (data.enabled) assertSpeechToTextModel(data.model);
      await guard("transcription-settings");
      const old = (
        await sql<{
          api_key_cipher: string | null;
        }>`select api_key_cipher from transcription_settings where user_id=${owner}`
      )[0];
      const cipher = data.clearKey
        ? null
        : data.apiKey
          ? sealMediaCredential(data.apiKey, owner, material)
          : (old?.api_key_cipher ?? null);
      if (data.enabled && !cipher)
        throw new Error("Enter an OpenAI transcription API key or disable transcription");
      await sql`insert into transcription_settings(user_id,model,enabled,api_key_cipher) values(${owner},${data.model},${data.enabled},${cipher}) on conflict(user_id)do update set model=excluded.model,enabled=excluded.enabled,api_key_cipher=excluded.api_key_cipher,updated_at=now()`;
      return this.metadata(owner);
    },
    async credential(owner: string) {
      const row = (
        await sql<{
          model: string;
          enabled: boolean;
          api_key_cipher: string | null;
        }>`select model,enabled,api_key_cipher from transcription_settings where user_id=${owner}`
      )[0];
      if (!row?.enabled || !row.api_key_cipher)
        throw new Error("Configure and enable transcription in Settings → LLM first");
      assertSpeechToTextModel(row.model);
      return { model: row.model, cipher: row.api_key_cipher };
    },
  };
}
