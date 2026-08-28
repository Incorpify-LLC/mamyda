import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { n as nid } from "./utils-BeBjTMyx.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { r as getSql } from "./db-DjflF1RW.mjs";
import { a as mapMinute, d as mapVault, o as mapNote } from "./map-DPubJFHY.mjs";
import { n as titleFromBody, t as extractTags } from "./tags-gdYcVXxO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/writing-BTGRQL-S.js
async function notesWithTags(userId) {
	const sql = await getSql();
	const notes = await sql`
    select * from notes where user_id = ${userId} order by updated_at desc
  `;
	const tags = await sql`
    select note_id, tag from note_tags where user_id = ${userId}
  `;
	const byNote = /* @__PURE__ */ new Map();
	for (const t of tags) {
		const list = byNote.get(t.note_id) ?? [];
		list.push(t.tag);
		byNote.set(t.note_id, list);
	}
	return notes.map((n) => mapNote(n, byNote.get(String(n.id)) ?? []));
}
var listMinutes_createServerFn_handler = createServerRpc({
	id: "b2e0c8fb724e58549e2ec10038f94b0b3645c4af0d72d89c4d34f56e23e7e81b",
	name: "listMinutes",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => listMinutes.__executeServer(opts));
var listMinutes = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listMinutes_createServerFn_handler, async ({ context }) => {
	return (await (await getSql())`
      select * from minutes where user_id = ${context.userId} order by updated_at desc
    `).map(mapMinute);
});
var saveMinute_createServerFn_handler = createServerRpc({
	id: "6772205d08fac6a28b076246a31a8710c1920f0cb5a7d0edbfb70a49fc38b158",
	name: "saveMinute",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => saveMinute.__executeServer(opts));
var saveMinute = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveMinute_createServerFn_handler, async ({ context, data }) => {
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
var deleteMinute_createServerFn_handler = createServerRpc({
	id: "5a3c34633e92ed964e9e329712f4312f4304881f0f87b64f33239165cd5c0624",
	name: "deleteMinute",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => deleteMinute.__executeServer(opts));
var deleteMinute = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(deleteMinute_createServerFn_handler, async ({ context, data: id }) => {
	await (await getSql())`delete from minutes where id = ${id} and user_id = ${context.userId}`;
	return { ok: true };
});
var polishMinutes_createServerFn_handler = createServerRpc({
	id: "c7dd6f284e7b4637103371cf588ab0e3e64ad2b4bd6fc67f826518ce31f1e740",
	name: "polishMinutes",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => polishMinutes.__executeServer(opts));
var polishMinutes = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(polishMinutes_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "AI is not available"
	};
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			max_tokens: 800,
			messages: [{
				role: "system",
				content: "Rewrite meeting bullets into clear minutes. Keep facts, decisions, owners, and next steps. No fluff. Plain text with short headings: Summary, Decisions, Actions."
			}, {
				role: "user",
				content: `Title: ${data.title}\nAttendees: ${data.attendees ?? ""}\n\n${data.body}`
			}]
		})
	});
	if (!res.ok) return {
		ok: false,
		error: `xAI API error ${res.status}`
	};
	return {
		ok: true,
		text: (await res.json()).choices[0]?.message.content ?? ""
	};
});
var listNotes_createServerFn_handler = createServerRpc({
	id: "4d8be61920c2b916f7d7b330130231656d8bd7a709149c68c3752a9bbbd7a337",
	name: "listNotes",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => listNotes.__executeServer(opts));
var listNotes = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listNotes_createServerFn_handler, async ({ context }) => notesWithTags(context.userId));
var saveNote_createServerFn_handler = createServerRpc({
	id: "4f54b14bf9b1faeeca8955e4cb115560b61e5067cf0fd1a62d0c5c8344cfb20a",
	name: "saveNote",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => saveNote.__executeServer(opts));
var saveNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveNote_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const body = data.body;
	const title = (data.title?.trim() || titleFromBody(body)).slice(0, 80);
	const tags = extractTags(body);
	const projects = await sql`
      select id, slug from projects where user_id = ${context.userId} and archived = false
    `;
	const slugMap = new Map(projects.map((p) => [p.slug, p.id]));
	let projectId = data.projectId ?? null;
	if (!projectId) for (const tag of tags) {
		const hit = slugMap.get(tag);
		if (hit) {
			projectId = hit;
			break;
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
	for (const tag of tags) await sql`
        insert into note_tags (note_id, user_id, tag, project_id)
        values (${id}, ${context.userId}, ${tag}, ${slugMap.get(tag) ?? null})
        on conflict do nothing
      `;
	return notesWithTags(context.userId);
});
var deleteNote_createServerFn_handler = createServerRpc({
	id: "9b6d20f1dd9a6bedf3c17f31959fdad0f635fd24f6727454dc6ab7ebebd5687a",
	name: "deleteNote",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => deleteNote.__executeServer(opts));
var deleteNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(deleteNote_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await getSql();
	await sql`delete from note_tags where note_id = ${id} and user_id = ${context.userId}`;
	await sql`delete from notes where id = ${id} and user_id = ${context.userId}`;
	return notesWithTags(context.userId);
});
var listVault_createServerFn_handler = createServerRpc({
	id: "d8445d96eff593343c0744f608245391b906246de29a4a2d5d2c1c71243d3962",
	name: "listVault",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => listVault.__executeServer(opts));
var listVault = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listVault_createServerFn_handler, async ({ context }) => {
	return (await (await getSql())`
      select id, title, created_at, updated_at from vault_notes
      where user_id = ${context.userId} order by updated_at desc
    `).map(mapVault);
});
var getVaultCipher_createServerFn_handler = createServerRpc({
	id: "9623741604d8458c9f5cb43f54d73994ba21a85dfc895be3ec1a9960a38591c5",
	name: "getVaultCipher",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => getVaultCipher.__executeServer(opts));
var getVaultCipher = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(getVaultCipher_createServerFn_handler, async ({ context, data: id }) => {
	const row = (await (await getSql())`
      select ciphertext, title from vault_notes where id = ${id} and user_id = ${context.userId}
    `)[0];
	if (!row) throw new Error("Note not found");
	return row;
});
var saveVaultNote_createServerFn_handler = createServerRpc({
	id: "311f58173c5833df742dd4f3d2fb7c954f9518f661edecedee2aa39294b2902d",
	name: "saveVaultNote",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => saveVaultNote.__executeServer(opts));
var saveVaultNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveVaultNote_createServerFn_handler, async ({ context, data }) => {
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
var deleteVaultNote_createServerFn_handler = createServerRpc({
	id: "394c9c16041915395ae6ed95c2aa9b614371b655dc7c6e137fec8a061c7f614e",
	name: "deleteVaultNote",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => deleteVaultNote.__executeServer(opts));
var deleteVaultNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(deleteVaultNote_createServerFn_handler, async ({ context, data: id }) => {
	await (await getSql())`delete from vault_notes where id = ${id} and user_id = ${context.userId}`;
	return { ok: true };
});
var saveVaultKeys_createServerFn_handler = createServerRpc({
	id: "66e816d05ef088c46f6772c88a873df2ada0d10f48a764e42f10b319b283dcfb",
	name: "saveVaultKeys",
	filename: "src/lib/mamyda/writing.ts"
}, (opts) => saveVaultKeys.__executeServer(opts));
var saveVaultKeys = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveVaultKeys_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      insert into profiles (user_id, vault_public_key, vault_private_key_armored, vault_key_created_at)
      values (${context.userId}, ${data.publicKey}, ${data.privateKeyArmored}, now())
      on conflict (user_id) do update set
        vault_public_key = excluded.vault_public_key,
        vault_private_key_armored = excluded.vault_private_key_armored,
        vault_key_created_at = now()
    `;
	return { ok: true };
});
//#endregion
export { deleteMinute_createServerFn_handler, deleteNote_createServerFn_handler, deleteVaultNote_createServerFn_handler, getVaultCipher_createServerFn_handler, listMinutes_createServerFn_handler, listNotes_createServerFn_handler, listVault_createServerFn_handler, polishMinutes_createServerFn_handler, saveMinute_createServerFn_handler, saveNote_createServerFn_handler, saveVaultKeys_createServerFn_handler, saveVaultNote_createServerFn_handler };
