import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { createMediaService, createTranscriptionSettings } from "@/lib/mamyda/media.server";
import { mediaDisk } from "@/lib/mamyda/media-storage.server";
import { assertVaultOrigin, vaultRequestBody } from "@/lib/mamyda/vault-api.server";
import { requireTurnstile } from "@/lib/mamyda/turnstile.server";
export const Route = createFileRoute("/api/media/uploads/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const owner = await requireUserId();
          assertVaultOrigin(request);
          if (request.headers.get("content-type") !== "application/octet-stream")
            throw new Error("Binary upload required");
          const raw = request.headers.get("x-media-chunk");
          if (!raw || !/^\d+$/.test(raw)) throw new Error("Chunk index required");
          const sql = await getSql();
          const settings = createTranscriptionSettings(sql, requireTurnstile);
          await createMediaService(sql, requireTurnstile, mediaDisk, (user) =>
            settings.credential(user),
          ).upload(owner, params.id, Number(raw), vaultRequestBody(request));
          return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "Unauthorized";
          return new Response(
            unauthorized
              ? "Unauthorized"
              : "Recording upload failed; retry this chunk or select the recording again",
            { status: unauthorized ? 401 : 400, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
