import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
export const getPrivateContent = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({ kind: z.enum(["task", "note", "chat"]), id: z.string().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows =
      data.kind === "task"
        ? await sql<{
            content_object_key: string;
            content_key_fingerprint: string;
          }>`select content_object_key,content_key_fingerprint from tasks where id=${data.id} and user_id=${context.userId}`
        : data.kind === "note"
          ? await sql<{
              content_object_key: string;
              content_key_fingerprint: string;
            }>`select content_object_key,content_key_fingerprint from notes where id=${data.id} and user_id=${context.userId}`
          : await sql<{
              content_object_key: string;
              content_key_fingerprint: string;
            }>`select content_object_key,content_key_fingerprint from llm_chats where id=${data.id} and user_id=${context.userId}`;
    if (!rows[0]?.content_object_key) throw new Error("Encrypted content not found");
    const { readContentObject } = await import("./files");
    return {
      ciphertext: await readContentObject(rows[0].content_object_key),
      fingerprint: rows[0].content_key_fingerprint,
    };
  });
