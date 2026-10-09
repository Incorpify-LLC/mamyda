import { beforeAll, afterAll, beforeEach, test, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Sql } from "@/lib/db";
import { createLLMService } from "@/lib/mamyda/llm.server";
let db: PGlite, sql: Sql;
const guard = vi.fn(async () => {}),
  fetcher = vi.fn(async () =>
    Response.json({ choices: [{ message: { content: "Corrected text" }, finish_reason: "stop" }] }),
  );
let service: ReturnType<typeof createLLMService>;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync("migrations/0010_llm_settings.sql", "utf8"));
  sql = (async (parts: TemplateStringsArray, ...args: unknown[]) => {
    return (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        args,
      )
    ).rows;
  }) as Sql;
  sql.query = async (q, args = []) => (await db.query(q, args)).rows as any;
});
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec("truncate llm_settings,llm_usage_windows");
  vi.clearAllMocks();
  service = createLLMService(sql, guard, fetcher as typeof fetch, {
    credentialKey: "test-only-key-with-at-least-32-characters",
  });
});
const settings = {
  provider: "openai",
  model: "selected-model",
  enabled: true,
  apiKey: "private-test-key",
};
test("keys are protected at rest and never returned; blank updates preserve only same-provider keys", async () => {
  await service.save("alice", settings);
  const meta = await service.settings("alice");
  expect(meta.hasKey).toBe(true);
  expect(JSON.stringify(meta)).not.toContain(settings.apiKey);
  const row = (await db.query<any>("select api_key_cipher from llm_settings")).rows[0];
  expect(row.api_key_cipher).not.toContain(settings.apiKey);
  await service.save("alice", { ...settings, apiKey: "", model: "new-model" });
  expect((await service.settings("alice")).hasKey).toBe(true);
  await expect(
    service.save("alice", { ...settings, provider: "xai", apiKey: "" }),
  ).rejects.toThrow();
  expect((await service.settings("bob")).hasKey).toBe(false);
});
test("requests require explicit consent and use configured endpoint/model with server-only credentials", async () => {
  await service.save("alice", settings);
  await expect(service.edit("alice", { kind: "spellcheck", body: "Teh text" })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await service.edit("alice", {
      kind: "spellcheck",
      body: "Teh text",
      consent: true,
      selection: { provider: "openai", model: "selected-model" },
    }),
  ).toBe("Corrected text");
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  expect(JSON.parse(options.body as string)).toMatchObject({
    model: "selected-model",
    max_completion_tokens: 2048,
    store: false,
  });
  expect(JSON.parse(options.body as string).messages[1].content).toBe("Teh text");
  await expect(
    service.edit("bob", {
      kind: "polish",
      body: "text",
      consent: true,
      selection: { provider: "openai", model: "selected-model" },
    }),
  ).rejects.toThrow();
});
test("disabled preferences stop server fallback and provider errors do not leak secrets or content", async () => {
  service = createLLMService(sql, guard, fetcher as typeof fetch, {
    credentialKey: "test-only-key-with-at-least-32-characters",
    serverXaiKey: "server-test-key",
  });
  await service.save("alice", { ...settings, enabled: false });
  await expect(
    service.edit("alice", {
      kind: "polish",
      body: "private",
      consent: true,
      selection: { provider: "openai", model: "selected-model" },
    }),
  ).rejects.toThrow("disabled");
  await service.save("alice", settings);
  fetcher.mockResolvedValueOnce(new Response("private-test-key private text", { status: 401 }));
  await expect(
    service.edit("alice", {
      kind: "polish",
      body: "private",
      consent: true,
      selection: { provider: "openai", model: "selected-model" },
    }),
  ).rejects.toThrow("credentials");
});
test("credential ciphertext is bound to owner and provider and deleting keys disables assistance", async () => {
  await service.save("alice", settings);
  await db.exec(
    "insert into llm_settings select 'bob',provider,model,enabled,api_key_cipher,max_tokens,updated_at from llm_settings where user_id='alice'",
  );
  await expect(
    service.edit("bob", {
      kind: "polish",
      body: "text",
      consent: true,
      selection: { provider: "openai", model: "selected-model" },
    }),
  ).rejects.toThrow("could not be opened");
  expect(fetcher).not.toHaveBeenCalled();
  await service.save("alice", { ...settings, enabled: false, clearKey: true, apiKey: "" });
  expect((await service.settings("alice")).hasKey).toBe(false);
});
test("provider requests are rate limited and truncated responses never replace drafts", async () => {
  await service.save("alice", settings);
  const request = {
    kind: "polish",
    body: "text",
    consent: true,
    selection: { provider: "openai", model: "selected-model" },
  };
  fetcher.mockResolvedValueOnce(
    Response.json({ choices: [{ message: { content: "Partial" }, finish_reason: "length" }] }),
  );
  await expect(service.edit("alice", request)).rejects.toThrow("did not finish");
  for (let i = 0; i < 4; i++) await service.edit("alice", request);
  await expect(service.edit("alice", request)).rejects.toThrow("Too many");
  expect(fetcher).toHaveBeenCalledTimes(5);
});
test("changing configuration cannot silently send content to a different consent target", async () => {
  await service.save("alice", settings);
  await expect(
    service.edit("alice", {
      kind: "polish",
      body: "private",
      consent: true,
      selection: { provider: "xai", model: "other" },
    }),
  ).rejects.toThrow("settings changed");
  expect(fetcher).not.toHaveBeenCalled();
});
test("editing unwraps only the known metadata envelope and rejects broken wrappers", async () => {
  await service.save("alice", settings);
  const request = {
    kind: "spellcheck",
    body: "Teh text",
    consent: true,
    selection: { provider: "openai", model: "selected-model" },
  };
  for (const text of [
    '{"title":"Ensure good feedback","attendees":"","content":"The text"}',
    '```json\n{"content":"The text"}\n```',
  ]) {
    fetcher.mockResolvedValueOnce(
      Response.json({ choices: [{ message: { content: text }, finish_reason: "stop" }] }),
    );
    expect(await service.edit("alice", request)).toBe("The text");
  }
  fetcher.mockResolvedValueOnce(
    Response.json({
      choices: [{ message: { content: '{"title":"Only title"}' }, finish_reason: "stop" }],
    }),
  );
  await expect(service.edit("alice", request)).rejects.toThrow("draft is unchanged");
});
test("chat forwards explicit model, effort and bounded history/context without editing JSON replies", async () => {
  await service.save("alice", settings);
  const request = {
    kind: "chat",
    selection: {
      provider: "openai",
      configuredModel: "selected-model",
      model: "other-model",
      effort: "low",
    },
    body: "What next?",
    history: [{ role: "assistant", content: "Earlier reply" }],
    context: [{ label: "Task A", body: "Deploy carefully" }],
    consent: true,
  };
  fetcher.mockResolvedValueOnce(
    Response.json({
      choices: [
        { message: { content: '{"content":"Requested JSON example"}' }, finish_reason: "stop" },
      ],
    }),
  );
  expect(await service.edit("alice", request)).toBe('{"content":"Requested JSON example"}');
  expect(guard).toHaveBeenCalledWith("llm-chat");
  const options = fetcher.mock.calls[0][1] as RequestInit;
  const body = JSON.parse(options.body as string);
  expect(body).toMatchObject({ model: "other-model", reasoning_effort: "low" });
  expect(body.messages.at(-1).content).toBe("What next?");
  expect(body.messages[1].content).toContain("Deploy carefully");
  await expect(service.edit("alice", { ...request, consent: false })).rejects.toThrow();
  await expect(
    service.edit("alice", { ...request, history: [{ role: "system", content: "bad" }] }),
  ).rejects.toThrow();
  await expect(
    service.edit("alice", {
      ...request,
      selection: { ...request.selection, configuredModel: "stale" },
    }),
  ).rejects.toThrow("settings changed");
});
