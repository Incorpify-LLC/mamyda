import { beforeAll, afterAll, beforeEach, expect, test, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const state = vi.hoisted(() => ({ userId: "alice", sql: undefined as any }));
// Exercise actual handlers and SQL; transport/auth verification is tested separately.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown) => value;
    const chain = {
      middleware: () => chain,
      validator: (fn: typeof validate) => {
        validate = fn;
        return chain;
      },
      handler:
        (fn: any) =>
        async (input: any = {}) =>
          fn({ context: { userId: state.userId }, data: validate(input.data) }),
    };
    return chain;
  },
}));
vi.mock("@/lib/auth/middleware", () => ({ authMiddleware: {} }));
vi.mock("@/lib/db", () => ({ getSql: async () => state.sql }));
vi.mock("@/lib/mamyda/private-content.server", () => ({
  storePrivateContent: async () => "private/object",
}));
vi.mock("@/lib/mamyda/files", () => ({ readContentObject: async () => "ciphertext" }));
import { getPrivateContent } from "@/lib/mamyda/private-content";
import {
  upsertProject,
  upsertTask,
  updateProfile,
  getWorkspace,
  clearSampleData,
} from "@/lib/mamyda/workspace";
import { saveNote, saveMinute, saveVaultKeys, listNotes } from "@/lib/mamyda/writing";
import { runAlerts } from "@/lib/mamyda/alerts";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("migrations/0002_mamyda.sql", "utf8"));
  await db.exec(readFileSync("migrations/0005_calendar_sync.sql", "utf8"));
  await db.exec(readFileSync("migrations/0006_notification_delivery.sql", "utf8"));
  await db.exec(readFileSync("migrations/0009_private_content.sql", "utf8"));
  state.sql = async (parts: TemplateStringsArray, ...args: unknown[]) => {
    const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return (await db.query(query, args)).rows;
  };
  state.sql.query = async (query: string, args: unknown[]) => (await db.query(query, args)).rows;
});
afterAll(async () => db.close());
beforeEach(async () => {
  state.userId = "alice";
  await db.exec(`TRUNCATE notification_deliveries, profiles, clients, projects, tasks, notes, note_tags, minutes, vault_notes, alerts, email_log, calendar_events;
    INSERT INTO profiles (user_id, alert_email) VALUES ('alice', 'alice@example.test'), ('bob', 'bob@example.test');
    INSERT INTO clients (id,user_id,name) VALUES ('c1','alice','One'),('c2','alice','Two'),('cb','bob','Bob');
    INSERT INTO projects (id,user_id,client_id,name,slug) VALUES ('p1','alice','c1','One','one'),('p2','alice','c2','Two','two'),('pb','bob','cb','Bob','bob');
    INSERT INTO tasks (id,user_id,project_id,title) VALUES ('t1','alice','p1','Task');
    INSERT INTO notes (id,user_id,title,body) VALUES ('nb','bob','Private','Secret');
    INSERT INTO calendar_events (id,user_id,source_provider,title,starts_at) VALUES ('eb','bob','local','Private',now());`);
});
test("editing a project saves the selected client", async () => {
  await upsertProject({ data: { id: "p1", clientId: "c2", name: "Moved" } });
  expect(
    (await db.query<any>("SELECT client_id FROM projects WHERE id='p1'")).rows[0].client_id,
  ).toBe("c2");
});
test("editing a task saves the selected project", async () => {
  await upsertTask({ data: { id: "t1", projectId: "p2", title: "Moved" } });
  expect(
    (await db.query<any>("SELECT project_id FROM tasks WHERE id='t1'")).rows[0].project_id,
  ).toBe("p2");
});
test("encrypted task bodies are absent from DB, survive locked metadata edits and reject stale plaintext", async () => {
  const encryption = { ciphertext: "ciphertext", fingerprint: "a".repeat(40) };
  await upsertTask({
    data: { id: "t1", projectId: "p1", title: "Visible", labels: ["tag"], encryption },
  });
  let row = (await db.query<any>("select notes,content_object_key,labels from tasks where id='t1'"))
    .rows[0];
  expect(row.notes).toBeNull();
  expect(row.content_object_key).toBe("private/object");
  await upsertTask({ data: { id: "t1", projectId: "p1", title: "Renamed" } });
  row = (await db.query<any>("select notes,content_object_key from tasks where id='t1'")).rows[0];
  expect(row).toEqual({ notes: null, content_object_key: "private/object" });
  await expect(
    upsertTask({ data: { id: "t1", projectId: "p1", title: "Stale", notes: "secret" } }),
  ).rejects.toThrow("plaintext");
  expect((await getPrivateContent({ data: { kind: "task", id: "t1" } })).ciphertext).toBe(
    "ciphertext",
  );
  state.userId = "bob";
  await expect(getPrivateContent({ data: { kind: "task", id: "t1" } })).rejects.toThrow();
});
test("encrypted note stores explicit searchable metadata but no plaintext body", async () => {
  const encryption = { ciphertext: "ciphertext", fingerprint: "a".repeat(40) };
  const saved = await saveNote({
    data: { body: "", title: "Visible name", tags: ["tag"], projectId: "p1", encryption },
  });
  expect(saved.notes.find((n) => n.id === saved.id)).toMatchObject({
    title: "Visible name",
    body: "",
    tags: ["tag"],
    encrypted: true,
  });
  await expect(saveNote({ data: { id: saved.id, body: "stale plaintext" } })).rejects.toThrow(
    "plaintext",
  );
  await expect(saveNote({ data: { id: saved.id, body: "" } })).rejects.toThrow("Unlock");
  expect((await getPrivateContent({ data: { kind: "note", id: saved.id } })).ciphertext).toBe(
    "ciphertext",
  );
  state.userId = "bob";
  await expect(getPrivateContent({ data: { kind: "note", id: saved.id } })).rejects.toThrow();
});
test("notes cannot link another account project", async () => {
  await expect(saveNote({ data: { body: "Note", projectId: "pb" } })).rejects.toThrow();
});
test("note project picker supports an explicit link and an explicit unlinked note", async () => {
  const linked = await saveNote({ data: { body: "Project work", projectId: "p2" } });
  expect(
    (await db.query("SELECT project_id FROM notes WHERE id=$1", [linked.id])).rows[0]?.project_id,
  ).toBe("p2");
  const unlinked = await saveNote({
    data: { body: "#one is still a regular tag", projectId: null },
  });
  expect(
    (await db.query("SELECT project_id FROM notes WHERE id=$1", [unlinked.id])).rows[0]?.project_id,
  ).toBeNull();
  expect(
    (await db.query("SELECT tag FROM note_tags WHERE note_id=$1", [unlinked.id])).rows[0]?.tag,
  ).toBe("one");
});
test("legacy notes still infer a project from a slug tag when no project is supplied", async () => {
  const note = await saveNote({ data: { body: "#one legacy project link" } });
  expect(
    (await db.query("SELECT project_id FROM notes WHERE id=$1", [note.id])).rows[0]?.project_id,
  ).toBe("p1");
});
test("editing another account note cannot insert tags", async () => {
  await expect(saveNote({ data: { id: "nb", body: "#intrusion" } })).rejects.toThrow();
  expect((await db.query("SELECT * FROM note_tags")).rows).toHaveLength(0);
});
test("minutes cannot link another account event", async () => {
  await expect(
    saveMinute({ data: { title: "Minutes", body: "Body", eventId: "eb" } }),
  ).rejects.toThrow();
});
test("minutes cannot link another account project", async () => {
  await expect(
    saveMinute({ data: { title: "Minutes", body: "Body", projectId: "pb" } }),
  ).rejects.toThrow();
});
test("clearing alert email persists null", async () => {
  await updateProfile({ data: { alertEmail: null } });
  expect((await getWorkspace()).profile.alertEmail).toBeNull();
});
test("vault setup cannot overwrite keys and strand existing encrypted notes", async () => {
  await saveVaultKeys({ data: { publicKey: "first", privateKeyArmored: "first-secret" } });
  await expect(
    saveVaultKeys({ data: { publicKey: "second", privateKeyArmored: "second-secret" } }),
  ).rejects.toThrow();
  expect((await getWorkspace()).profile.vaultPublicKey).toBe("first");
});
test("invalid task priority is rejected before storing", async () => {
  await expect(
    upsertTask({ data: { projectId: "p1", title: "Bad", priority: "unknown" } }),
  ).rejects.toThrow();
});
test("reads and task writes remain scoped to the account", async () => {
  expect(await listNotes()).toHaveLength(0);
  await expect(upsertTask({ data: { projectId: "pb", title: "Attack" } })).rejects.toThrow();
  state.userId = "bob";
  expect((await listNotes())[0].body).toBe("Secret");
});
test("concurrent alert checks do not fail or duplicate emails", async () => {
  await db.exec("UPDATE tasks SET due_at = now() - interval '1 day' WHERE id='t1'");
  await Promise.all([runAlerts(), runAlerts()]);
  expect((await db.query("SELECT * FROM alerts")).rows).toHaveLength(1);
  expect((await db.query("SELECT * FROM email_log")).rows).toHaveLength(1);
});
test("removing sample parents preserves user-created work relationships", async () => {
  await db.exec(
    "UPDATE clients SET is_sample=true WHERE id='c1'; UPDATE projects SET is_sample=true WHERE id='p1'",
  );
  await clearSampleData();
  const ws = await getWorkspace();
  expect(ws.projects.some((p) => p.id === "p1")).toBe(true);
  expect(ws.clients.some((c) => c.id === "c1")).toBe(true);
});
