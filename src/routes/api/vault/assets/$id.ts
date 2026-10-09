import { createFileRoute } from "@tanstack/react-router";
import { readVaultRequest } from "@/lib/mamyda/vault-api.server";

export const Route = createFileRoute("/api/vault/assets/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          return await readVaultRequest(params.id);
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "Unauthorized";
          return new Response(unauthorized ? "Unauthorized" : "Asset unavailable", {
            status: unauthorized ? 401 : 404,
            headers: { "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
