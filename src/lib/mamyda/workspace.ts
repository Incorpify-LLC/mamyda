import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { TASK_COLUMNS } from "@/lib/columns";
import { slugify, nid } from "@/lib/utils";
import { addDays, iso, startOfDay, zonedDate, APP_TZ } from "@/lib/time";
import { mapClient, mapProfile, mapProject, mapTask } from "./map";
import type { WorkspaceSnapshot } from "./types";

async function ensureProfile(userId: string, email?: string | null) {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, alert_email)
    values (${userId}, ${email ?? null})
    on conflict (user_id) do nothing
  `;
}

async function loadWorkspace(userId: string): Promise<WorkspaceSnapshot> {
  const sql = await getSql();
  const profiles = await sql<Record<string, unknown>>`
    select * from profiles where user_id = ${userId}
  `;
  const profileRow = profiles[0];
  if (!profileRow) {
    await ensureProfile(userId);
    return loadWorkspace(userId);
  }
  const clients = await sql<Record<string, unknown>>`
    select * from clients where user_id = ${userId} and archived = false
    order by name
  `;
  const projects = await sql<Record<string, unknown>>`
    select * from projects where user_id = ${userId} and archived = false
    order by name
  `;
  const tasks = await sql<Record<string, unknown>>`
    select * from tasks where user_id = ${userId}
    order by position, created_at
  `;
  return {
    profile: mapProfile(profileRow),
    clients: clients.map(mapClient),
    projects: projects.map(mapProject),
    tasks: tasks.map(mapTask),
  };
}

async function uniqueSlug(userId: string, name: string): Promise<string> {
  const sql = await getSql();
  const base = slugify(name);
  let slug = base;
  let n = 2;
  for (;;) {
    const rows = await sql<{ id: string }>`
      select id from projects where user_id = ${userId} and slug = ${slug}
    `;
    if (rows.length === 0) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureProfile(context.userId);
    return loadWorkspace(context.userId);
  });

export const seedWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const existing = await sql<{ seeded_at: string | null }>`
      select seeded_at from profiles where user_id = ${context.userId}
    `;
    if (existing[0]?.seeded_at) return loadWorkspace(context.userId);

    const now = new Date();
    const today = startOfDay(now);
    const day0 = today;
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

    const due = (offset: number, h = 18) => {
      const d = addDays(day0, offset);
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const bag = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      return iso(
        zonedDate(Number(bag.year), Number(bag.month), Number(bag.day), h, 0),
      );
    };

    type SeedTask = [string, string, string, string, string | null, string, number];
    const seedTasks: SeedTask[] = [
      [nid(), pDash, "Wire KPI tiles", "doing", due(0), "high", 0],
      [nid(), pDash, "Review funnel drop-off", "this_week", due(1), "normal", 1],
      [nid(), pDash, "Ship export CSV", "backlog", due(5), "low", 2],
      [nid(), pApi, "Map auth surfaces", "this_week", due(0), "urgent", 0],
      [nid(), pApi, "Write rate-limit notes", "waiting", due(2), "normal", 1],
      [nid(), pContract, "Clause library v1", "doing", due(1), "high", 0],
      [nid(), pContract, "Client intake form", "backlog", due(6), "normal", 1],
      [nid(), pLaunch, "Hero copy pass", "this_week", due(0), "high", 0],
      [nid(), pLaunch, "Product stills", "waiting", due(3), "normal", 1],
      [nid(), pLaunch, "Favicon + OG", "done", due(-1), "low", 0],
      [nid(), pOps, "Connect Zoho calendar", "backlog", due(2), "normal", 0],
      [nid(), pOps, "Log Harbor minutes", "this_week", due(0), "high", 1],
    ];
    for (const [id, projectId, title, column, dueAt, priority, position] of seedTasks) {
      await sql`
        insert into tasks (id, user_id, project_id, title, column_id, due_at, priority, position, labels, is_sample)
        values (
          ${id}, ${context.userId}, ${projectId}, ${title}, ${column}, ${dueAt},
          ${priority}, ${position}, ${JSON.stringify(["sample"])}, true
        )
      `;
    }

    const eventAt = (offset: number, h: number, min: number, durMin: number) => {
      const d = addDays(day0, offset);
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const bag = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      const start = zonedDate(
        Number(bag.year),
        Number(bag.month),
        Number(bag.day),
        h,
        min,
      );
      const end = new Date(start.getTime() + durMin * 60_000);
      return { start: iso(start), end: iso(end) };
    };

    const events: Array<{
      title: string;
      loc: string;
      project: string;
      t: { start: string; end: string };
    }> = [
      { title: "Meridian standup", loc: "Meet", project: pDash, t: eventAt(0, 9, 30, 25) },
      { title: "Harbor contract call", loc: "Zoom", project: pContract, t: eventAt(0, 11, 0, 45) },
      { title: "Deep work — dashboard", loc: "", project: pDash, t: eventAt(0, 14, 0, 90) },
      { title: "Atelier review", loc: "Studio", project: pLaunch, t: eventAt(0, 16, 30, 60) },
      { title: "API audit working session", loc: "Meet", project: pApi, t: eventAt(1, 10, 0, 60) },
      { title: "Weekly planning", loc: "", project: pOps, t: eventAt(1, 17, 0, 40) },
    ];
    for (const ev of events) {
      await sql`
        insert into calendar_events (
          id, user_id, source_provider, title, location, starts_at, ends_at,
          project_id, attendees, is_sample
        ) values (
          ${nid()}, ${context.userId}, ${"sample"}, ${ev.title}, ${ev.loc || null},
          ${ev.t.start}, ${ev.t.end}, ${ev.project}, ${"[]"}, true
        )
      `;
    }

    await sql`
      insert into minutes (id, user_id, project_id, title, attendees, body)
      values (
        ${nid()}, ${context.userId}, ${pContract},
        ${"Harbor kickoff"}, ${"Priya, Dev, you"},
        ${"Scope: intake → clause library → signature.\nOpen: who owns redlines?\nNext: draft v1 by Friday."}
      )
    `;

    const noteBody =
      "Ship the hero with quieter type. Hold the film stills until Thursday. #launch-site #atelier";
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

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; name: string; color?: string; email?: string; notes?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = data.id ?? nid();
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    if (data.id) {
      await sql`
        update clients set
          name = ${name},
          color = ${data.color ?? "sage"},
          email = ${data.email?.trim() || null},
          notes = ${data.notes ?? null},
          updated_at = now()
        where id = ${id} and user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into clients (id, user_id, name, color, email, notes)
        values (${id}, ${context.userId}, ${name}, ${data.color ?? "sage"}, ${data.email?.trim() || null}, ${data.notes ?? null})
      `;
    }
    return loadWorkspace(context.userId);
  });

export const archiveClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`
      update clients set archived = true, updated_at = now()
      where id = ${id} and user_id = ${context.userId}
    `;
    return loadWorkspace(context.userId);
  });

export const upsertProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; clientId: string; name: string; description?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    const owned = await sql<{ id: string }>`
      select id from clients where id = ${data.clientId} and user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("Client not found");
    if (data.id) {
      await sql`
        update projects set
          name = ${name},
          description = ${data.description ?? null},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
    } else {
      const slug = await uniqueSlug(context.userId, name);
      await sql`
        insert into projects (id, user_id, client_id, name, slug, description)
        values (${nid()}, ${context.userId}, ${data.clientId}, ${name}, ${slug}, ${data.description ?? null})
      `;
    }
    return loadWorkspace(context.userId);
  });

export const archiveProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`
      update projects set archived = true, updated_at = now()
      where id = ${id} and user_id = ${context.userId}
    `;
    return loadWorkspace(context.userId);
  });

export const upsertTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id?: string;
    projectId: string;
    title: string;
    notes?: string;
    columnId?: string;
    priority?: string;
    dueAt?: string | null;
    labels?: string[];
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const title = data.title.trim();
    if (!title) throw new Error("Title is required");
    const owned = await sql<{ id: string }>`
      select id from projects where id = ${data.projectId} and user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("Project not found");
    const columnId = TASK_COLUMNS.some((c) => c.id === data.columnId)
      ? data.columnId
      : "backlog";
    const labels = JSON.stringify(data.labels ?? []);
    if (data.id) {
      await sql`
        update tasks set
          title = ${title},
          notes = ${data.notes ?? null},
          column_id = ${columnId!},
          priority = ${data.priority ?? "normal"},
          due_at = ${data.dueAt ?? null},
          labels = ${labels},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
      `;
    } else {
      const max = await sql<{ m: number | null }>`
        select max(position) as m from tasks
        where user_id = ${context.userId} and project_id = ${data.projectId} and column_id = ${columnId!}
      `;
      const position = (max[0]?.m ?? 0) + 1;
      await sql`
        insert into tasks (id, user_id, project_id, title, notes, column_id, priority, due_at, labels, position)
        values (${nid()}, ${context.userId}, ${data.projectId}, ${title}, ${data.notes ?? null}, ${columnId!}, ${data.priority ?? "normal"}, ${data.dueAt ?? null}, ${labels}, ${position})
      `;
    }
    return loadWorkspace(context.userId);
  });

export const moveTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; columnId: string; position: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const columnId = TASK_COLUMNS.some((c) => c.id === data.columnId)
      ? data.columnId
      : "backlog";
    await sql`
      update tasks set column_id = ${columnId!}, position = ${data.position}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return loadWorkspace(context.userId);
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from tasks where id = ${id} and user_id = ${context.userId}`;
    return loadWorkspace(context.userId);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    alertEmail?: string | null;
    alertsDueSoon?: boolean;
    alertsOverdue?: boolean;
    alertsMeeting?: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
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

export const clearSampleData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from calendar_events where user_id = ${context.userId} and is_sample = true`;
    await sql`delete from tasks where user_id = ${context.userId} and is_sample = true`;
    await sql`delete from projects where user_id = ${context.userId} and is_sample = true`;
    await sql`delete from clients where user_id = ${context.userId} and is_sample = true`;
    return loadWorkspace(context.userId);
  });
