import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const reserveAssetUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { vaultWorkflow } = await import("./vault-api.server");
    return (await vaultWorkflow()).reserve(context.userId, data);
  });
export const finalizeAssetUpload = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const { vaultWorkflow } = await import("./vault-api.server");
    return (await vaultWorkflow()).finalize(context.userId, data);
  });
export const listAssets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { vaultWorkflow } = await import("./vault-api.server");
    return (await vaultWorkflow()).list(context.userId);
  });
export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data }) => {
    const { vaultWorkflow } = await import("./vault-api.server");
    return (await vaultWorkflow()).delete(context.userId, data);
  });
