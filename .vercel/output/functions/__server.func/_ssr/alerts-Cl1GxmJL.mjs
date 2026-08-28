import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { n as nid } from "./utils-BeBjTMyx.mjs";
import { o as formatTime, r as formatDay } from "./time-B-7xH25t.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { r as getSql } from "./db-DjflF1RW.mjs";
import { r as mapEmail, s as mapProfile, t as mapAlert } from "./map-DPubJFHY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/alerts-Cl1GxmJL.js
var FROM = "alerts@mamyda.saneax.in";
async function queueEmail(userId, to, subject, body) {
	await (await getSql())`
    insert into email_log (id, user_id, to_address, from_address, subject, body, status)
    values (${nid()}, ${userId}, ${to}, ${FROM}, ${subject}, ${body}, ${"logged"})
  `;
}
var runAlerts_createServerFn_handler = createServerRpc({
	id: "5d1c7e50c43a1f22442c38b13b84b42254fd893e1a05d62be127cefef2eb654b",
	name: "runAlerts",
	filename: "src/lib/mamyda/alerts.ts"
}, (opts) => runAlerts.__executeServer(opts));
var runAlerts = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(runAlerts_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const profiles = await sql`
      select * from profiles where user_id = ${context.userId}
    `;
	const profile = profiles[0] ? mapProfile(profiles[0]) : null;
	if (!profile) return { created: 0 };
	const to = profile.alertEmail;
	const now = /* @__PURE__ */ new Date();
	const in24h = new Date(now.getTime() + 864e5);
	const in30 = new Date(now.getTime() + 18e5);
	let created = 0;
	async function insertAlert(opts) {
		if ((await sql`
        select id from alerts
        where user_id = ${context.userId}
          and kind = ${opts.kind}
          and entity_id = ${opts.entityId}
          and scheduled_for = ${opts.scheduledFor}
      `)[0]) return;
		const id = nid();
		await sql`
        insert into alerts (
          id, user_id, kind, title, body, entity_type, entity_id, scheduled_for, sent_at, status
        ) values (
          ${id}, ${context.userId}, ${opts.kind}, ${opts.title}, ${opts.body},
          ${opts.entityType}, ${opts.entityId}, ${opts.scheduledFor}, now(), ${"logged"}
        )
      `;
		if (to) await queueEmail(context.userId, to, opts.title, opts.body);
		created += 1;
	}
	if (profile.alertsOverdue) {
		const overdue = await sql`
        select id, title, due_at from tasks
        where user_id = ${context.userId}
          and due_at is not null
          and due_at < ${now.toISOString()}
          and column_id <> 'done'
      `;
		for (const t of overdue) await insertAlert({
			kind: "overdue",
			title: `Overdue: ${t.title}`,
			body: `${t.title} was due ${formatDay(t.due_at)}.`,
			entityType: "task",
			entityId: t.id,
			scheduledFor: t.due_at
		});
	}
	if (profile.alertsDueSoon) {
		const soon = await sql`
        select id, title, due_at from tasks
        where user_id = ${context.userId}
          and due_at is not null
          and due_at >= ${now.toISOString()}
          and due_at <= ${in24h.toISOString()}
          and column_id <> 'done'
      `;
		for (const t of soon) await insertAlert({
			kind: "due_soon",
			title: `Due soon: ${t.title}`,
			body: `${t.title} is due ${formatDay(t.due_at)} ${formatTime(t.due_at)}.`,
			entityType: "task",
			entityId: t.id,
			scheduledFor: t.due_at
		});
	}
	if (profile.alertsMeeting) {
		const meetings = await sql`
        select id, title, starts_at from calendar_events
        where user_id = ${context.userId}
          and starts_at >= ${now.toISOString()}
          and starts_at <= ${in30.toISOString()}
      `;
		for (const m of meetings) await insertAlert({
			kind: "meeting",
			title: `Starting soon: ${m.title}`,
			body: `${m.title} starts at ${formatTime(m.starts_at)}.`,
			entityType: "event",
			entityId: m.id,
			scheduledFor: m.starts_at
		});
	}
	return { created };
});
var listAlerts_createServerFn_handler = createServerRpc({
	id: "7441271781997431224359b1f5254dcbdf5342cfd608a39e43437078b8a8940c",
	name: "listAlerts",
	filename: "src/lib/mamyda/alerts.ts"
}, (opts) => listAlerts.__executeServer(opts));
var listAlerts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listAlerts_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const alerts = await sql`
      select * from alerts where user_id = ${context.userId}
      order by created_at desc limit 40
    `;
	const emails = await sql`
      select * from email_log where user_id = ${context.userId}
      order by created_at desc limit 20
    `;
	return {
		alerts: alerts.map(mapAlert),
		emails: emails.map(mapEmail)
	};
});
//#endregion
export { listAlerts_createServerFn_handler, runAlerts_createServerFn_handler };
