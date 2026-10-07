import { createFileRoute } from "@tanstack/react-router";
import { readOwnedFile } from "@/lib/mamyda/files";
import { requireUserId } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const userId = await requireUserId();
          const file = await readOwnedFile(userId, params.id);
          if (!file) return new Response("Not found", { status: 404 });
          const name = file.name.replace(/["\r\n]/g, "");
          const body = new Uint8Array(file.bytes.byteLength);
          body.set(file.bytes);
          return new Response(body, {
            headers: {
              "content-type": file.contentType,
              "content-disposition": `attachment; filename="${name}"`,
              "cache-control": "private, no-store",
            },
          });
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
      },
    },
  },
});
