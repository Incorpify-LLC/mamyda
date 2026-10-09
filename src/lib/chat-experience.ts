import { parseChatBlob, type ChatMessage } from "@/lib/llm-config";

export type ChatSubmission = "ask" | "save";
export type ChatSecurity = { action: ChatSubmission | null; token: string; generation: number };
export const initialChatSecurity: ChatSecurity = { action: null, token: "", generation: 0 };

export function chatTurnstileAction(action: ChatSubmission) {
  return action === "ask" ? "llm-chat" : "chat-save";
}

export function chatSecurityReducer(
  state: ChatSecurity,
  event:
    | { type: "begin"; action: ChatSubmission }
    | { type: "close" }
    | { type: "token"; generation: number; token: string },
): ChatSecurity {
  if (event.type === "token") {
    if (!state.action || event.generation !== state.generation) return state;
    return { ...state, token: event.token };
  }
  return {
    action: event.type === "begin" ? event.action : null,
    token: "",
    generation: state.generation + 1,
  };
}

export function plainChatSave(input: {
  id?: string;
  date: string;
  title: string;
  tags: string;
  revision: number;
  messages: ChatMessage[];
  encrypted: boolean;
}) {
  if (input.encrypted) throw new Error("Previously encrypted chats are read-only here");
  const body = JSON.stringify({ version: 1, messages: input.messages });
  parseChatBlob(body);
  return {
    id: input.id,
    date: input.date,
    title: input.title,
    revision: input.revision,
    body,
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}
