import { expect, test } from "vitest";
import {
  chatSecurityReducer,
  initialChatSecurity,
  chatTurnstileAction,
  plainChatSave,
} from "@/lib/chat-experience";

test("chat has no challenge until an explicit submission", () => {
  expect(initialChatSecurity.action).toBeNull();
  const state = chatSecurityReducer(initialChatSecurity, { type: "begin", action: "ask" });
  expect(state.action).toBe("ask");
  expect(state.token).toBe("");
  expect(chatTurnstileAction(state.action!)).toBe("llm-chat");
});

test("switching send to save always invalidates the old action token", () => {
  const asking = chatSecurityReducer(initialChatSecurity, { type: "begin", action: "ask" });
  const verified = chatSecurityReducer(asking, {
    type: "token",
    generation: asking.generation,
    token: "send-token",
  });
  const saving = chatSecurityReducer(verified, { type: "begin", action: "save" });
  expect(saving.token).toBe("");
  expect(chatTurnstileAction(saving.action!)).toBe("chat-save");
  expect(
    chatSecurityReducer(saving, {
      type: "token",
      generation: asking.generation,
      token: "late-send-token",
    }),
  ).toEqual(saving);
});

test("close and completed requests discard tokens; retries require a new challenge", () => {
  const opened = chatSecurityReducer(initialChatSecurity, { type: "begin", action: "ask" });
  const closed = chatSecurityReducer(opened, { type: "close" });
  expect(closed.action).toBeNull();
  expect(
    chatSecurityReducer(closed, { type: "token", generation: opened.generation, token: "late" }),
  ).toEqual(closed);
  const retry = chatSecurityReducer(closed, { type: "begin", action: "ask" });
  expect(retry.token).toBe("");
  expect(retry.generation).toBeGreaterThan(opened.generation);
});

test("expiry clears the token without automatically sending a question", () => {
  const opened = chatSecurityReducer(initialChatSecurity, { type: "begin", action: "ask" });
  const verified = chatSecurityReducer(opened, {
    type: "token",
    generation: opened.generation,
    token: "token",
  });
  const expired = chatSecurityReducer(verified, {
    type: "token",
    generation: opened.generation,
    token: "",
  });
  expect(expired.action).toBe("ask");
  expect(expired.token).toBe("");
});

test("new chats save plain searchable content with no encryption payload", () => {
  const saved = plainChatSave({
    date: "2026-10-08",
    title: "Daily chat",
    tags: "release, notes",
    revision: 0,
    messages: [{ role: "user", content: "Question" }],
    encrypted: false,
  });
  expect(saved.tags).toEqual(["release", "notes"]);
  expect(JSON.parse(saved.body).messages[0].content).toBe("Question");
  expect(saved).not.toHaveProperty("encryption");
});

test("legacy encrypted chats cannot accidentally be overwritten in plaintext", () => {
  expect(() =>
    plainChatSave({
      id: "legacy",
      date: "2026-10-08",
      title: "Legacy",
      tags: "",
      revision: 1,
      messages: [{ role: "user", content: "private" }],
      encrypted: true,
    }),
  ).toThrow("read-only");
});
