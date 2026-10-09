import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Sql } from "@/lib/db";
import { parseChatBlob } from "@/lib/llm-config";
import { assertContentWrite } from "@/lib/content-privacy";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    "Invalid date",
  );
const saveInput = z
  .object({
    id: z.string().max(200).optional(),
    date,
    title: z.string().trim().min(1).max(120),
    tags: z.array(z.string().trim().min(1).max(48)).max(20),
    revision: z.number().int().min(0),
    body: z.string().max(100000),
    encryption: z
      .object({
        ciphertext: z.string().min(1).max(500000),
        fingerprint: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ChatMeta = {
  id: string;
  chat_date: string;
  title: string;
  tags: string[];
  revision: number;
  encrypted: boolean;
};
type ChatRow = ChatMeta & {
  body: string;
  content_object_key: string | null;
  content_key_fingerprint: string | null;
};
export function createChatArchive(
  sql: Sql,
  guard: (action: string) => Promise<void>,
  put: (owner: string, payload: { ciphertext: string; fingerprint: string }) => Promise<string>,
) {
  return {
    async list(owner: string, raw: unknown) {
      const filter = z
        .object({ search: z.string().max(200).default(""), date: date.optional() })
        .parse(raw);
      const pattern = `%${filter.search}%`;
      return sql<ChatMeta>`select id,chat_date::text,title,tags,revision,(content_object_key is not null) as encrypted from llm_chats where user_id=${owner} and (${filter.date ?? null}::date is null or chat_date=${filter.date ?? null}::date) and (title ilike ${pattern} or array_to_string(tags,' ') ilike ${pattern} or chat_date::text ilike ${pattern} or (content_object_key is null and body ilike ${pattern})) order by chat_date desc limit 100`;
    },
    async load(owner: string, id: string) {
      const row = (
        await sql<ChatRow>`select *,chat_date::text from llm_chats where id=${id} and user_id=${owner}`
      )[0];
      if (!row) throw new Error("Chat not found");
      return {
        id: row.id,
        date: row.chat_date,
        title: row.title,
        tags: row.tags,
        revision: row.revision,
        encrypted: Boolean(row.content_object_key),
        body: row.body,
      };
    },
    async save(owner: string, raw: unknown) {
      const data = saveInput.parse(raw);
      await guard("chat-save");
      const old = (
        await sql<ChatRow>`select * from llm_chats where user_id=${owner} and chat_date=${data.date}`
      )[0];
      if (
        (old && (old.id !== data.id || old.revision !== data.revision)) ||
        (!old && (data.id || data.revision !== 0))
      )
        throw new Error(
          "Daily chat changed; reopen the saved day before saving. Your draft is kept.",
        );
      assertContentWrite(data.body, Boolean(data.encryption), Boolean(old?.content_object_key));
      if (old?.content_object_key && !data.encryption)
        throw new Error("Unlock and save this chat encrypted");
      if (!data.encryption) parseChatBlob(data.body);
      const objectKey = data.encryption ? await put(owner, data.encryption) : null;
      const id = old?.id ?? randomUUID();
      const changed =
        await sql`insert into llm_chats(id,user_id,chat_date,title,tags,body,content_object_key,content_key_fingerprint) values(${id},${owner},${data.date},${data.title},${data.tags},${data.body},${objectKey},${data.encryption?.fingerprint ?? null}) on conflict(user_id,chat_date) do update set title=excluded.title,tags=excluded.tags,body=excluded.body,content_object_key=excluded.content_object_key,content_key_fingerprint=excluded.content_key_fingerprint,revision=llm_chats.revision+1,updated_at=now() where llm_chats.id=${data.id ?? null} and llm_chats.revision=${data.revision} returning id`;
      if (!changed[0])
        throw new Error("Daily chat changed; reopen before saving. Your draft is kept.");
      return this.load(owner, id);
    },
  };
}
