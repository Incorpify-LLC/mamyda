import { z } from "zod";
export const LLM_PROVIDERS = [
  { id: "xai", label: "xAI", url: "https://api.x.ai/v1/chat/completions" },
  { id: "openai", label: "OpenAI", url: "https://api.openai.com/v1/chat/completions" },
  { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions" },
] as const;
export const llmSettingsInput = z
  .object({
    provider: z.enum(["xai", "openai", "openrouter"]),
    model: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9_./:@+-]+$/),
    enabled: z.boolean(),
    apiKey: z.string().trim().max(1000).optional(),
    clearKey: z.boolean().default(false),
    maxTokens: z.number().int().min(256).max(4096).default(2048),
  })
  .strict();
export const llmEditInput = z
  .object({
    selection: z
      .object({
        provider: z.enum(["xai", "openai", "openrouter"]),
        model: z.string().min(1).max(120),
      })
      .strict(),
    kind: z.enum(["minutes-polish", "polish", "spellcheck"]),
    title: z.string().max(500).default(""),
    attendees: z.string().max(2000).default(""),
    body: z.string().trim().min(1).max(20000),
    consent: z.literal(true),
  })
  .strict();
export type LLMSettings = {
  provider: "xai" | "openai" | "openrouter";
  model: string;
  enabled: boolean;
  hasKey: boolean;
  maxTokens: number;
  source: "personal" | "server" | "none";
};
export const chatMessage = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(50000),
    model: z.string().max(120).optional(),
    effort: z.string().max(20).optional(),
    context: z.array(z.string().max(250)).max(8).optional(),
  })
  .strict();
export type ChatMessage = z.infer<typeof chatMessage>;
export const chatBlob = z
  .object({ version: z.literal(1), messages: z.array(chatMessage).max(200) })
  .strict();
export function parseChatBlob(text: string): ChatMessage[] {
  if (text.length > 100000)
    throw new Error("Daily chat exceeds 100,000 characters; shorten it before saving");
  return chatBlob.parse(JSON.parse(text)).messages;
}
export const llmChatInput = z
  .object({
    kind: z.literal("chat"),
    selection: z
      .object({
        provider: z.enum(["xai", "openai", "openrouter"]),
        configuredModel: z.string().min(1).max(120),
        model: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[a-zA-Z0-9_./:@+-]+$/),
        effort: z.enum(["default", "low", "medium", "high"]).default("default"),
      })
      .strict(),
    body: z.string().trim().min(1).max(20000),
    history: z.array(chatMessage).max(80),
    context: z
      .array(z.object({ label: z.string().max(250), body: z.string().max(20000) }).strict())
      .max(8),
    consent: z.literal(true),
  })
  .strict()
  .refine(
    (data) =>
      data.body.length +
        data.history.reduce((sum, item) => sum + item.content.length, 0) +
        data.context.reduce((sum, item) => sum + item.body.length, 0) <=
      100000,
    "Chat input exceeds 100,000 characters",
  );
