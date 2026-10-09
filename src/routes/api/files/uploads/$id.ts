import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { createFileUploads } from "@/lib/mamyda/file-uploads.server";
import { writeFileObject } from "@/lib/mamyda/files";
import { assertVaultOrigin, vaultRequestBody } from "@/lib/mamyda/vault-api.server";
import { requireTurnstile } from "@/lib/mamyda/turnstile.server";
export const Route = createFileRoute("/api/files/uploads/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const owner = await requireUserId();
          assertVaultOrigin(request);
          if (request.headers.get("content-type") !== "application/octet-stream")
            throw new Error("Binary upload required");
          await createFileUploads(
            await getSql(),
            { put: writeFileObject },
            requireTurnstile,
          ).upload(owner, params.id, vaultRequestBody(request));
          return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "Unauthorized";
          return new Response(
            unauthorized ? "Unauthorized" : "File upload failed; retry or select the file again",
            { status: unauthorized ? 401 : 400, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
