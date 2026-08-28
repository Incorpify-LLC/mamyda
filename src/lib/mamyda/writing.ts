import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { extractTags, titleFromBody } from "@/lib/tags";
import { nid } from "@/lib/utils";
import { mapMinute, mapNote, mapVault } from "./map";
import type { Minute, Note, VaultNoteMeta } from "./types";

async function notesWithTags(userId: string): Promise<Note[]> {
  const sql = await getSql();
  const notes = await sql<Record<string, unknown>>`
    select * from notes where user_id = ${userId} order by updated_at desc
  `;
  const tags = await sql<{ note_id: string; tag: string }>`
    select note_id, tag from note_tags where user_id = ${userId}
  `;
  const byNote = new Map<string, string[]>();
  for (const t of tags) {
    const list = byNote.get(t.note_id) ?? [];
    list.push(t.tag);
    byNote.set(t.note_id, list);
  }
  return notes.map((n) => mapNote(n, byNote.get(String(n.id)) ?? []));
}

export const listMinutes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from minutes where user_id = ${context.userId} order by updated_at desc
    `;
    return rows.map(mapMinute);
  });

export const saveMinute = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id?: string;
    title: string;
    body: string;
    attendees?: string;
    eventId?: string | null;
    projectId?: string | null;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const title = data.title.trim() || "Untitled minutes";
    if (data.id) {
      await sql`
        update minutes set
          title = ${title},
          body = ${data.body},
          attendees = ${data.attendees ?? ""},
          event_id = ${data.eventId ?? null},
          project_id = ${data.projectId ?? null},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      return data.id;
    }
    const id = nid();
    await sql`
      insert into minutes (id, user_id, title, body, attendees, event_id, project_id)
      values (${id}, ${context.userId}, ${title}, ${data.body}, ${data.attendees ?? ""}, ${data.eventId ?? null}, ${data.projectId ?? null})
    `;
    return id;
  });

export const deleteMinute = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from minutes where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const polishMinutes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; body: string; attendees?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Rewrite meeting bullets into clear minutes. Keep facts, decisions, owners, and next steps. No fluff. Plain text with short headings: Summary, Decisions, Actions.",
          },
          {
            role: "user",
            content: `Title: ${data.title}\nAttendees: ${data.attendees ?? ""}\n\n${data.body}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return { ok: true as const, text: body.choices[0]?.message.content ?? "" };
  });

export const listNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => notesWithTags(context.userId));

export const saveNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; body: string; title?: string; projectId?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const body = data.body;
    const title = (data.title?.trim() || titleFromBody(body)).slice(0, 80);
    const tags = extractTags(body);
    const projects = await sql<{ id: string; slug: string }>`
      select id, slug from projects where user_id = ${context.userId} and archived = false
    `;
    const slugMap = new Map(projects.map((p) => [p.slug, p.id]));
    let projectId = data.projectId ?? null;
    if (!projectId) {
      for (const tag of tags) {
        const hit = slugMap.get(tag);
        if (hit) {
          projectId = hit;
          break;
        }
      }
    }
    let id = data.id;
    if (id) {
      await sql`
        update notes set title = ${title}, body = ${body}, project_id = ${projectId}, updated_at = now()
        where id = ${id} and user_id = ${context.userId}
      `;
      await sql`delete from note_tags where note_id = ${id} and user_id = ${context.userId}`;
    } else {
      id = nid();
      await sql`
        insert into notes (id, user_id, project_id, title, body)
        values (${id}, ${context.userId}, ${projectId}, ${title}, ${body})
      `;
    }
    for (const tag of tags) {
      await sql`
        insert into note_tags (note_id, user_id, tag, project_id)
        values (${id}, ${context.userId}, ${tag}, ${slugMap.get(tag) ?? null})
        on conflict do nothing
      `;
    }
    return notesWithTags(context.userId);
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from note_tags where note_id = ${id} and user_id = ${context.userId}`;
    await sql`delete from notes where id = ${id} and user_id = ${context.userId}`;
    return notesWithTags(context.userId);
  });

export const listVault = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select id, title, created_at, updated_at from vault_notes
      where user_id = ${context.userId} order by updated_at desc
    `;
    return rows.map(mapVault);
  });

export const getVaultCipher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ ciphertext: string; title: string }>`
      select ciphertext, title from vault_notes where id = ${id} and user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Note not found");
    return row;
  });

export const saveVaultNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; title: string; ciphertext: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const title = data.title.trim() || "Untitled";
    if (data.id) {
      await sql`
        update vault_notes set title = ${title}, ciphertext = ${data.ciphertext}, updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
      return data.id;
    }
    const id = nid();
    await sql`
      insert into vault_notes (id, user_id, title, ciphertext)
      values (${id}, ${context.userId}, ${title}, ${data.ciphertext})
    `;
    return id;
  });

export const deleteVaultNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from vault_notes where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const saveVaultKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { publicKey: string; privateKeyArmored: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, vault_public_key, vault_private_key_armored, vault_key_created_at)
      values (${context.userId}, ${data.publicKey}, ${data.privateKeyArmored}, now())
      on conflict (user_id) do update set
        vault_public_key = excluded.vault_public_key,
        vault_private_key_armored = excluded.vault_private_key_armored,
        vault_key_created_at = now()
    `;
    return { ok: true };
  });

export type { Minute, Note, VaultNoteMeta };
