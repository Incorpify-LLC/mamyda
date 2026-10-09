import { idInput, keysInput, minuteInput, noteInput, vaultInput } from "./validation";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { extractTags, titleFromBody } from "@/lib/tags";
import { nid } from "@/lib/utils";
import { mapMinute, mapNote, mapVault } from "./map";
import type { Minute, Note, VaultNoteMeta } from "./types";
import { requireTurnstile } from "./turnstile.server";

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
  .validator((input: unknown) => minuteInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireTurnstile("minute-save");
    const sql = await getSql();
    if (data.projectId) {
      const owned =
        await sql`select id from projects where id = ${data.projectId} and user_id = ${context.userId}`;
      if (!owned[0]) throw new Error("Project not found");
    }
    if (data.eventId) {
      const owned =
        await sql`select id from calendar_events where id = ${data.eventId} and user_id = ${context.userId}`;
      if (!owned[0]) throw new Error("Event not found");
    }
    const title = data.title.trim() || "Untitled minutes";
    if (data.id) {
      const updated = await sql`
        update minutes set
          title = ${title},
          body = ${data.body},
          attendees = ${data.attendees ?? ""},
          event_id = ${data.eventId ?? null},
          project_id = ${data.projectId ?? null},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated[0])
        throw new Error("Minutes no longer exist. Copy your draft before reloading.");
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
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from minutes where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const listNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => notesWithTags(context.userId));

export const saveNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => noteInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireTurnstile("note-save");
    const sql = await getSql();
    if (data.projectId) {
      const owned =
        await sql`select id from projects where id = ${data.projectId} and user_id = ${context.userId}`;
      if (!owned[0]) throw new Error("Project not found");
    }
    if (data.id) {
      const owned =
        await sql`select id from notes where id = ${data.id} and user_id = ${context.userId}`;
      if (!owned[0]) throw new Error("Note not found");
    }
    const existing = data.id
      ? (
          await sql<{
            content_object_key: string | null;
            content_key_fingerprint: string | null;
          }>`select content_object_key,content_key_fingerprint from notes where id=${data.id} and user_id=${context.userId}`
        )[0]
      : undefined;
    const { assertContentWrite } = await import("@/lib/content-privacy");
    assertContentWrite(data.body, Boolean(data.encryption), Boolean(existing?.content_object_key));
    if (existing?.content_object_key && !data.encryption)
      throw new Error("Unlock this note before editing and save it encrypted");
    const objectKey = data.encryption
      ? await (
          await import("./private-content.server")
        ).storePrivateContent(sql, context.userId, data.encryption)
      : null;
    const fingerprint = data.encryption?.fingerprint ?? null;
    const body = data.body;
    const title = (data.title?.trim() || titleFromBody(body)).slice(0, 80);
    const tags = data.encryption ? data.tags! : extractTags(body);
    const projects = await sql<{ id: string; slug: string }>`
      select id, slug from projects where user_id = ${context.userId} and archived = false
    `;
    const slugMap = new Map(projects.map((p) => [p.slug, p.id]));
    const projectWasExplicitlySet = Object.hasOwn(data, "projectId");
    let projectId = data.projectId ?? null;
    if (!projectId && !projectWasExplicitlySet) {
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
      const changed = await sql`
        update notes set title = ${title}, body = ${body}, project_id = ${projectId}, content_object_key=${objectKey},content_key_fingerprint=${fingerprint}, updated_at = now()
        where id = ${id} and user_id = ${context.userId}
          and content_object_key is not distinct from ${existing?.content_object_key ?? null}
        returning id
      `;
      if (!changed[0]) throw new Error("Note content changed; reload before saving");
      await sql`delete from note_tags where note_id = ${id} and user_id = ${context.userId}`;
    } else {
      id = nid();
      await sql`
        insert into notes (id, user_id, project_id, title, body,content_object_key,content_key_fingerprint)
        values (${id}, ${context.userId}, ${projectId}, ${title}, ${body},${objectKey},${fingerprint})
      `;
    }
    for (const tag of tags) {
      await sql`
        insert into note_tags (note_id, user_id, tag, project_id)
        values (${id}, ${context.userId}, ${tag}, ${slugMap.get(tag) ?? null})
        on conflict do nothing
      `;
    }
    return { id, notes: await notesWithTags(context.userId) };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => idInput.parse(input))
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
  .validator((input: unknown) => idInput.parse(input))
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
  .validator((input: unknown) => vaultInput.parse(input))
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
  .validator((input: unknown) => idInput.parse(input))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from vault_notes where id = ${id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const saveVaultKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => keysInput.parse(input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const saved = await sql`
      insert into profiles (user_id, vault_public_key, vault_private_key_armored, vault_key_created_at)
      values (${context.userId}, ${data.publicKey}, ${data.privateKeyArmored}, now())
      on conflict (user_id) do update set
        vault_public_key = excluded.vault_public_key,
        vault_private_key_armored = excluded.vault_private_key_armored,
        vault_key_created_at = now()
      where profiles.vault_public_key is null and profiles.vault_private_key_armored is null
      returning user_id
    `;
    if (!saved[0]) throw new Error("Vault keys already exist; unlock your existing vault");
    return { ok: true };
  });

export type { Minute, Note, VaultNoteMeta };
