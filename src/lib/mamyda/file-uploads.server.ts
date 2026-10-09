import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Sql } from "@/lib/db";
import { MAX_FILE_BYTES, MAX_BATCH_FILES } from "@/lib/file-experience";
import { readBoundedCipher } from "./vault-storage.server";

const batch = z.object({
  clientId: z.string().min(1).max(200),
  projectId: z.string().min(1).max(200),
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        size: z.number().int().min(1).max(MAX_FILE_BYTES),
        contentType: z
          .string()
          .regex(/^[\w.+-]+\/[\w.+-]+$/)
          .max(150),
      }),
    )
    .min(1)
    .max(MAX_BATCH_FILES),
});
type Ticket = {
  id: string;
  user_id: string;
  client_id: string;
  project_id: string;
  name: string;
  content_type: string;
  byte_size: number;
  object_key: string;
  state: string;
  expires_at: Date | string;
};
export function createFileUploads(
  sql: Sql,
  store: { put(key: string, bytes: Uint8Array, type: string): Promise<void> },
  guard: (action: string) => Promise<void>,
) {
  return {
    async reserve(owner: string, raw: unknown) {
      await guard("file-upload");
      const data = batch.parse(raw);
      if (
        !(await sql`select id from clients where id=${data.clientId} and user_id=${owner}`)[0] ||
        !(
          await sql`select id from projects where id=${data.projectId} and client_id=${data.clientId} and user_id=${owner}`
        )[0]
      )
        throw new Error("Choose a project belonging to this client");
      const active = await sql<{
        count: string;
      }>`select count(*) from file_upload_requests where user_id=${owner} and expires_at>now() and state<>'ready'`;
      if (Number(active[0].count) + data.files.length > 60)
        throw new Error("Too many pending uploads; finish the current batch first");
      const tickets = data.files.map((file) => {
        const id = randomUUID();
        return {
          id,
          user_id: owner,
          client_id: data.clientId,
          project_id: data.projectId,
          name: file.name
            .split(/[/\\]/)
            .pop()!
            .replace(/[\r\n]/g, "_")
            .slice(0, 120),
          content_type: file.contentType,
          byte_size: file.size,
          object_key: `files/${createHash("sha256").update(owner).digest("hex")}/${id}`,
        };
      });
      await sql.query(
        `insert into file_upload_requests(id,user_id,client_id,project_id,name,content_type,byte_size,object_key)
        select id,user_id,client_id,project_id,name,content_type,byte_size,object_key from jsonb_to_recordset($1::jsonb)
        as x(id text,user_id text,client_id text,project_id text,name text,content_type text,byte_size integer,object_key text)`,
        [JSON.stringify(tickets)],
      );
      return tickets.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        url: `/api/files/uploads/${ticket.id}`,
      }));
    },
    async upload(owner: string, id: string, body: AsyncIterable<Uint8Array>) {
      z.string().uuid().parse(id);
      const row = (
        await sql<Ticket>`select * from file_upload_requests where id=${id} and user_id=${owner}`
      )[0];
      if (!row) throw new Error("Upload not found");
      if (row.state === "ready") return { id };
      if (new Date(row.expires_at).getTime() <= Date.now())
        throw new Error("Upload expired; select the file again");
      const claimed =
        await sql`update file_upload_requests set state='uploading' where id=${id} and user_id=${owner} and state='pending' and expires_at>now() returning id`;
      if (!claimed[0]) throw new Error("This upload is already in progress");
      try {
        const bytes = await readBoundedCipher(body, row.byte_size);
        await store.put(row.object_key, bytes, row.content_type);
        const published = await sql.query(
          `with saved as (
          insert into client_files(id,user_id,client_id,project_id,name,content_type,byte_size,object_key)
          select id,user_id,client_id,project_id,name,content_type,byte_size,object_key from file_upload_requests
          where id=$1 and user_id=$2 and state='uploading' and expires_at>now() returning id
        ) update file_upload_requests set state='ready' where id=$1 and user_id=$2 and exists(select 1 from saved) returning id`,
          [id, owner],
        );
        if (!published[0]) throw new Error("Upload expired before saving; select the file again");
        return { id };
      } catch (error) {
        await sql`update file_upload_requests set state='pending' where id=${id} and user_id=${owner} and state='uploading'`;
        throw error;
      }
    },
  };
}
