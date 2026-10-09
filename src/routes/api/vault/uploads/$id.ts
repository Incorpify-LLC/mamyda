import { createFileRoute } from "@tanstack/react-router";
import { uploadVaultRequest } from "@/lib/mamyda/vault-api.server";

export const Route = createFileRoute("/api/vault/uploads/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          return await uploadVaultRequest(request, params.id);
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "Unauthorized";
          return new Response(
            unauthorized ? "Unauthorized" : "Encrypted upload could not be accepted",
            { status: unauthorized ? 401 : 400, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
