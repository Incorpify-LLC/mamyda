import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { i as slugify, n as nid } from "./utils-BeBjTMyx.mjs";
import { c as iso, d as zonedDate, n as addDays, t as APP_TZ, u as startOfDay } from "./time-B-7xH25t.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { r as getSql } from "./db-DjflF1RW.mjs";
import { c as mapProject, n as mapClient, s as mapProfile, u as mapTask } from "./map-DPubJFHY.mjs";
import { r as TASK_COLUMNS } from "./columns-CxaszSyT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/workspace-DgbHEXFw.js
async function ensureProfile(userId, email) {
	await (await getSql())`
    insert into profiles (user_id, alert_email)
    values (${userId}, ${email ?? null})
    on conflict (user_id) do nothing
  `;
}
async function loadWorkspace(userId) {
	const sql = await getSql();
	const profileRow = (await sql`
    select * from profiles where user_id = ${userId}
  `)[0];
	if (!profileRow) {
		await ensureProfile(userId);
		return loadWorkspace(userId);
	}
	const clients = await sql`
    select * from clients where user_id = ${userId} and archived = false
    order by name
  `;
	const projects = await sql`
    select * from projects where user_id = ${userId} and archived = false
    order by name
  `;
	const tasks = await sql`
    select * from tasks where user_id = ${userId}
    order by position, created_at
  `;
	return {
		profile: mapProfile(profileRow),
		clients: clients.map(mapClient),
		projects: projects.map(mapProject),
		tasks: tasks.map(mapTask)
	};
}
async function uniqueSlug(userId, name) {
	const sql = await getSql();
	const base = slugify(name);
	let slug = base;
	let n = 2;
	for (;;) {
		if ((await sql`
      select id from projects where user_id = ${userId} and slug = ${slug}
    `).length === 0) return slug;
		slug = `${base}-${n}`;
		n += 1;
	}
}
var getWorkspace_createServerFn_handler = createServerRpc({
	id: "3a5c049d85fb686c719a9f78378f53c6532f1314b6d9ca548e30534ed4eb20d4",
	name: "getWorkspace",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => getWorkspace.__executeServer(opts));
var getWorkspace = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getWorkspace_createServerFn_handler, async ({ context }) => {
	await ensureProfile(context.userId);
	return loadWorkspace(context.userId);
});
var seedWorkspace_createServerFn_handler = createServerRpc({
	id: "9ea0d94a2c7c0e688568c31cb381a2d5a4f072761fbbb6991f9324943483fb76",
	name: "seedWorkspace",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => seedWorkspace.__executeServer(opts));
var seedWorkspace = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(seedWorkspace_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureProfile(context.userId);
	if ((await sql`
      select seeded_at from profiles where user_id = ${context.userId}
    `)[0]?.seeded_at) return loadWorkspace(context.userId);
	const day0 = startOfDay(/* @__PURE__ */ new Date());
	const meridian = nid();
	const harbor = nid();
	const atelier = nid();
	const internal = nid();
	const pDash = nid();
	const pApi = nid();
	const pContract = nid();
	const pLaunch = nid();
	const pOps = nid();
	await sql`
      insert into clients (id, user_id, name, color, email, notes, is_sample)
      values
        (${meridian}, ${context.userId}, ${"Meridian Labs"}, ${"sage"}, ${"ops@meridian.example"}, ${"Product design retainer"}, true),
        (${harbor}, ${context.userId}, ${"Harbor & Co."}, ${"ink"}, ${"work@harbor.example"}, ${"Legal operations"}, true),
        (${atelier}, ${context.userId}, ${"Atelier Rasa"}, ${"clay"}, ${"hello@rasa.example"}, ${"Brand and launch site"}, true),
        (${internal}, ${context.userId}, ${"Internal"}, ${"olive"}, null, ${"Personal ops"}, true)
    `;
	await sql`
      insert into projects (id, user_id, client_id, name, slug, description, is_sample)
      values
        (${pDash}, ${context.userId}, ${meridian}, ${"Q3 dashboard"}, ${"q3-dashboard"}, ${"Analytics refresh for the ops team"}, true),
        (${pApi}, ${context.userId}, ${meridian}, ${"API audit"}, ${"api-audit"}, ${"Auth and rate-limit review"}, true),
        (${pContract}, ${context.userId}, ${harbor}, ${"Contract workflow"}, ${"contract-workflow"}, ${"Intake to signature"}, true),
        (${pLaunch}, ${context.userId}, ${atelier}, ${"Launch site"}, ${"launch-site"}, ${"Marketing site for the autumn drop"}, true),
        (${pOps}, ${context.userId}, ${internal}, ${"Mamyda"}, ${"mamyda"}, ${"How this day is run"}, true)
    `;
	const due = (offset, h = 18) => {
		const d = addDays(day0, offset);
		const parts = new Intl.DateTimeFormat("en-GB", {
			timeZone: APP_TZ,
			year: "numeric",
			month: "2-digit",
			day: "2-digit"
		}).formatToParts(d);
		const bag = Object.fromEntries(parts.map((x) => [x.type, x.value]));
		return iso(zonedDate(Number(bag.year), Number(bag.month), Number(bag.day), h, 0));
	};
	const seedTasks = [
		[
			nid(),
			pDash,
			"Wire KPI tiles",
			"doing",
			due(0),
			"high",
			0
		],
		[
			nid(),
			pDash,
			"Review funnel drop-off",
			"this_week",
			due(1),
			"normal",
			1
		],
		[
			nid(),
			pDash,
			"Ship export CSV",
			"backlog",
			due(5),
			"low",
			2
		],
		[
			nid(),
			pApi,
			"Map auth surfaces",
			"this_week",
			due(0),
			"urgent",
			0
		],
		[
			nid(),
			pApi,
			"Write rate-limit notes",
			"waiting",
			due(2),
			"normal",
			1
		],
		[
			nid(),
			pContract,
			"Clause library v1",
			"doing",
			due(1),
			"high",
			0
		],
		[
			nid(),
			pContract,
			"Client intake form",
			"backlog",
			due(6),
			"normal",
			1
		],
		[
			nid(),
			pLaunch,
			"Hero copy pass",
			"this_week",
			due(0),
			"high",
			0
		],
		[
			nid(),
			pLaunch,
			"Product stills",
			"waiting",
			due(3),
			"normal",
			1
		],
		[
			nid(),
			pLaunch,
			"Favicon + OG",
			"done",
			due(-1),
			"low",
			0
		],
		[
			nid(),
			pOps,
			"Connect Zoho calendar",
			"backlog",
			due(2),
			"normal",
			0
		],
		[
			nid(),
			pOps,
			"Log Harbor minutes",
			"this_week",
			due(0),
			"high",
			1
		]
	];
	for (const [id, projectId, title, column, dueAt, priority, position] of seedTasks) await sql`
        insert into tasks (id, user_id, project_id, title, column_id, due_at, priority, position, labels, is_sample)
        values (
          ${id}, ${context.userId}, ${projectId}, ${title}, ${column}, ${dueAt},
          ${priority}, ${position}, ${JSON.stringify(["sample"])}, true
        )
      `;
	const eventAt = (offset, h, min, durMin) => {
		const d = addDays(day0, offset);
		const parts = new Intl.DateTimeFormat("en-GB", {
			timeZone: APP_TZ,
			year: "numeric",
			month: "2-digit",
			day: "2-digit"
		}).formatToParts(d);
		const bag = Object.fromEntries(parts.map((x) => [x.type, x.value]));
		const start = zonedDate(Number(bag.year), Number(bag.month), Number(bag.day), h, min);
		const end = new Date(start.getTime() + durMin * 6e4);
		return {
			start: iso(start),
			end: iso(end)
		};
	};
	const events = [
		{
			title: "Meridian standup",
			loc: "Meet",
			project: pDash,
			t: eventAt(0, 9, 30, 25)
		},
		{
			title: "Harbor contract call",
			loc: "Zoom",
			project: pContract,
			t: eventAt(0, 11, 0, 45)
		},
		{
			title: "Deep work — dashboard",
			loc: "",
			project: pDash,
			t: eventAt(0, 14, 0, 90)
		},
		{
			title: "Atelier review",
			loc: "Studio",
			project: pLaunch,
			t: eventAt(0, 16, 30, 60)
		},
		{
			title: "API audit working session",
			loc: "Meet",
			project: pApi,
			t: eventAt(1, 10, 0, 60)
		},
		{
			title: "Weekly planning",
			loc: "",
			project: pOps,
			t: eventAt(1, 17, 0, 40)
		}
	];
	for (const ev of events) await sql`
        insert into calendar_events (
          id, user_id, source_provider, title, location, starts_at, ends_at,
          project_id, attendees, is_sample
        ) values (
          ${nid()}, ${context.userId}, ${"sample"}, ${ev.title}, ${ev.loc || null},
          ${ev.t.start}, ${ev.t.end}, ${ev.project}, ${"[]"}, true
        )
      `;
	await sql`
      insert into minutes (id, user_id, project_id, title, attendees, body)
      values (
        ${nid()}, ${context.userId}, ${pContract},
        ${"Harbor kickoff"}, ${"Priya, Dev, you"},
        ${"Scope: intake → clause library → signature.\nOpen: who owns redlines?\nNext: draft v1 by Friday."}
      )
    `;
	const noteBody = "Ship the hero with quieter type. Hold the film stills until Thursday. #launch-site #atelier";
	const noteId = nid();
	await sql`
      insert into notes (id, user_id, project_id, title, body)
      values (${noteId}, ${context.userId}, ${pLaunch}, ${"Atelier copy notes"}, ${noteBody})
    `;
	await sql`
      insert into note_tags (note_id, user_id, tag, project_id)
      values
        (${noteId}, ${context.userId}, ${"launch-site"}, ${pLaunch}),
        (${noteId}, ${context.userId}, ${"atelier"}, null)
    `;
	await sql`
      update profiles set seeded_at = now() where user_id = ${context.userId}
    `;
	return loadWorkspace(context.userId);
});
var upsertClient_createServerFn_handler = createServerRpc({
	id: "3ed850ca17fb87fd8582212d926fc80d07d714122b30cad46d7aa22ffe3f4cbe",
	name: "upsertClient",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => upsertClient.__executeServer(opts));
var upsertClient = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(upsertClient_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const id = data.id ?? nid();
	const name = data.name.trim();
	if (!name) throw new Error("Name is required");
	if (data.id) await sql`
        update clients set
          name = ${name},
          color = ${data.color ?? "sage"},
          email = ${data.email?.trim() || null},
          notes = ${data.notes ?? null},
          updated_at = now()
        where id = ${id} and user_id = ${context.userId}
      `;
	else await sql`
        insert into clients (id, user_id, name, color, email, notes)
        values (${id}, ${context.userId}, ${name}, ${data.color ?? "sage"}, ${data.email?.trim() || null}, ${data.notes ?? null})
      `;
	return loadWorkspace(context.userId);
});
var archiveClient_createServerFn_handler = createServerRpc({
	id: "18bffdfe1ea714e2bd77f36581d1d2886e7f08913ce8619b2d26f705788db78f",
	name: "archiveClient",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => archiveClient.__executeServer(opts));
var archiveClient = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(archiveClient_createServerFn_handler, async ({ context, data: id }) => {
	await (await getSql())`
      update clients set archived = true, updated_at = now()
      where id = ${id} and user_id = ${context.userId}
    `;
	return loadWorkspace(context.userId);
});
var upsertProject_createServerFn_handler = createServerRpc({
	id: "325003616a338be236e27d8fe74ae70562ef316cea98bf28827823c533bd21be",
	name: "upsertProject",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => upsertProject.__executeServer(opts));
var upsertProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(upsertProject_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const name = data.name.trim();
	if (!name) throw new Error("Name is required");
	if (!(await sql`
      select id from clients where id = ${data.clientId} and user_id = ${context.userId}
    `)[0]) throw new Error("Client not found");
	if (data.id) await sql`
        update projects set
          name = ${name},
          description = ${data.description ?? null},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
	else {
		const slug = await uniqueSlug(context.userId, name);
		await sql`
        insert into projects (id, user_id, client_id, name, slug, description)
        values (${nid()}, ${context.userId}, ${data.clientId}, ${name}, ${slug}, ${data.description ?? null})
      `;
	}
	return loadWorkspace(context.userId);
});
var archiveProject_createServerFn_handler = createServerRpc({
	id: "997a773c0fcd0bbdd2ff68a435826dabfdaf9aeffe756843b9c9c4af066592fb",
	name: "archiveProject",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => archiveProject.__executeServer(opts));
var archiveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(archiveProject_createServerFn_handler, async ({ context, data: id }) => {
	await (await getSql())`
      update projects set archived = true, updated_at = now()
      where id = ${id} and user_id = ${context.userId}
    `;
	return loadWorkspace(context.userId);
});
var upsertTask_createServerFn_handler = createServerRpc({
	id: "0e707eb6ec0fb82227eb424af33175a6d3aa8aa082720c7e08c7589ade6732fe",
	name: "upsertTask",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => upsertTask.__executeServer(opts));
var upsertTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(upsertTask_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const title = data.title.trim();
	if (!title) throw new Error("Title is required");
	if (!(await sql`
      select id from projects where id = ${data.projectId} and user_id = ${context.userId}
    `)[0]) throw new Error("Project not found");
	const columnId = TASK_COLUMNS.some((c) => c.id === data.columnId) ? data.columnId : "backlog";
	const labels = JSON.stringify(data.labels ?? []);
	if (data.id) await sql`
        update tasks set
          title = ${title},
          notes = ${data.notes ?? null},
          column_id = ${columnId},
          priority = ${data.priority ?? "normal"},
          due_at = ${data.dueAt ?? null},
          labels = ${labels},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
	else {
		const position = ((await sql`
        select max(position) as m from tasks
        where user_id = ${context.userId} and project_id = ${data.projectId} and column_id = ${columnId}
      `)[0]?.m ?? 0) + 1;
		await sql`
        insert into tasks (id, user_id, project_id, title, notes, column_id, priority, due_at, labels, position)
        values (${nid()}, ${context.userId}, ${data.projectId}, ${title}, ${data.notes ?? null}, ${columnId}, ${data.priority ?? "normal"}, ${data.dueAt ?? null}, ${labels}, ${position})
      `;
	}
	return loadWorkspace(context.userId);
});
var moveTask_createServerFn_handler = createServerRpc({
	id: "6eb0671bbdaadf26dfe7fb08b82d672ec0a4f12b32f6e508aea841e00add1b70",
	name: "moveTask",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => moveTask.__executeServer(opts));
var moveTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(moveTask_createServerFn_handler, async ({ context, data }) => {
	await (await getSql())`
      update tasks set column_id = ${TASK_COLUMNS.some((c) => c.id === data.columnId) ? data.columnId : "backlog"}, position = ${data.position}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
	return loadWorkspace(context.userId);
});
var deleteTask_createServerFn_handler = createServerRpc({
	id: "9498a104dceb315330a9ebfa736a44abea0d28d79ac4310e7dd8ef7325b0b187",
	name: "deleteTask",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => deleteTask.__executeServer(opts));
var deleteTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(deleteTask_createServerFn_handler, async ({ context, data: id }) => {
	await (await getSql())`delete from tasks where id = ${id} and user_id = ${context.userId}`;
	return loadWorkspace(context.userId);
});
var updateProfile_createServerFn_handler = createServerRpc({
	id: "8088c02bcc73b825e04c4bbc4508e31ffec94baf9ea5e0bf9938559e464a4b2c",
	name: "updateProfile",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => updateProfile.__executeServer(opts));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(updateProfile_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureProfile(context.userId);
	await sql`
      update profiles set
        alert_email = coalesce(${data.alertEmail ?? null}, alert_email),
        alerts_due_soon = coalesce(${data.alertsDueSoon ?? null}, alerts_due_soon),
        alerts_overdue = coalesce(${data.alertsOverdue ?? null}, alerts_overdue),
        alerts_meeting = coalesce(${data.alertsMeeting ?? null}, alerts_meeting)
      where user_id = ${context.userId}
    `;
	return loadWorkspace(context.userId);
});
var clearSampleData_createServerFn_handler = createServerRpc({
	id: "94fc8b9fca3a7c4f67c5a1598d306369b47360c8c80a3286014616fb9b755623",
	name: "clearSampleData",
	filename: "src/lib/mamyda/workspace.ts"
}, (opts) => clearSampleData.__executeServer(opts));
var clearSampleData = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(clearSampleData_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await sql`delete from calendar_events where user_id = ${context.userId} and is_sample = true`;
	await sql`delete from tasks where user_id = ${context.userId} and is_sample = true`;
	await sql`delete from projects where user_id = ${context.userId} and is_sample = true`;
	await sql`delete from clients where user_id = ${context.userId} and is_sample = true`;
	return loadWorkspace(context.userId);
});
//#endregion
export { archiveClient_createServerFn_handler, archiveProject_createServerFn_handler, clearSampleData_createServerFn_handler, deleteTask_createServerFn_handler, getWorkspace_createServerFn_handler, moveTask_createServerFn_handler, seedWorkspace_createServerFn_handler, updateProfile_createServerFn_handler, upsertClient_createServerFn_handler, upsertProject_createServerFn_handler, upsertTask_createServerFn_handler };
