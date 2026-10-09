import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";
async function archive() {
  const { getSql } = await import("@/lib/db");
  const { requireTurnstile } = await import("./turnstile.server");
  const { createChatArchive } = await import("./chat.server");
  const { storePrivateContent } = await import("./private-content.server");
  const sql = await getSql();
  return createChatArchive(sql, requireTurnstile, (owner, data) =>
    storePrivateContent(sql, owner, data),
  );
}
export const listChats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => (await archive()).list(context.userId, data));
export const loadChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.string().min(1).max(200).parse(data))
  .handler(async ({ context, data }) => (await archive()).load(context.userId, data));
export const saveChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => data)
  .handler(async ({ context, data }) => (await archive()).save(context.userId, data));
export const listChatContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    return sql<{
      id: string;
      kind: "task" | "note" | "minute" | "file";
      title: string;
      encrypted: boolean;
    }>`
    select id,'task' as kind,title,(content_object_key is not null) as encrypted from tasks where user_id=${context.userId}
    union all select id,'note',title,(content_object_key is not null) from notes where user_id=${context.userId}
    union all select id,'minute',title,false from minutes where user_id=${context.userId}
    union all select id,'file',name,false from client_files where user_id=${context.userId}`;
  });
export const readChatContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({ id: z.string().min(1).max(200), kind: z.enum(["task", "note", "minute", "file"]) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (data.kind === "file") {
      const row = (
        await sql<{
          name: string;
          byte_size: number;
        }>`select name,byte_size from client_files where id=${data.id} and user_id=${context.userId}`
      )[0];
      if (!row) throw new Error("File not found");
      const { supportedContextFile, extractContextText } = await import("./context-text.server");
      if (!supportedContextFile(row.name, row.byte_size))
        throw new Error("Context supports PDF/DOCX up to 24 MiB or UTF-8 text files up to 2 MiB");
      const { readOwnedFile } = await import("./files");
      const file = await readOwnedFile(context.userId, data.id);
      if (!file) throw new Error("File unavailable");
      return extractContextText(file.name, file.bytes);
    }
    const rows =
      data.kind === "task"
        ? await sql<{
            body: string;
            encrypted: boolean;
          }>`select coalesce(notes,'') as body,(content_object_key is not null) as encrypted from tasks where id=${data.id} and user_id=${context.userId}`
        : data.kind === "note"
          ? await sql<{
              body: string;
              encrypted: boolean;
            }>`select body,(content_object_key is not null) as encrypted from notes where id=${data.id} and user_id=${context.userId}`
          : await sql<{
              body: string;
              encrypted: boolean;
            }>`select body,false as encrypted from minutes where id=${data.id} and user_id=${context.userId}`;
    if (!rows[0]) throw new Error("Context item not found");
    if (rows[0].encrypted) throw new Error("Unlock encrypted context with your passphrase first");
    if (rows[0].body.length > 20000)
      throw new Error("Context exceeds 20,000 characters; use a shorter excerpt");
    return rows[0].body;
  });
