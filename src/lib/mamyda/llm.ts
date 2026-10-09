import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
async function service() {
  const { getSql } = await import("@/lib/db");
  const { requireTurnstile } = await import("./turnstile.server");
  const { createLLMService } = await import("./llm.server");
  return createLLMService(await getSql(), requireTurnstile);
}
export const getLLMSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await service()).settings(context.userId));
export const saveLLMSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => (await service()).save(context.userId, data));
export const editWithLLM = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => ({
    text: await (await service()).edit(context.userId, data),
  }));
export const chatWithLLM = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => ({
    text: await (await service()).edit(context.userId, data),
  }));
