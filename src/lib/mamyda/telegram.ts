import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/** Client-safe proxy for the server-only Telegram implementation. */
export const beginTelegramLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireTurnstile } = await import("./turnstile.server");
    await requireTurnstile("telegram-link");
    const { createTelegramLink } = await import("./telegram.server");
    return createTelegramLink(context.userId);
  });
