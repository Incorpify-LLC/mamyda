import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { deploymentErrors } from "../../../scripts/deployment-config.mjs";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          if (deploymentErrors(process.env).length)
            throw new Error("Invalid deployment configuration");
          const { startTelegramPoller } = await import("@/lib/mamyda/telegram.server");
          startTelegramPoller();
          const sql = await getSql();
          await sql`select 1 from profiles limit 1`;
          await sql`select 1 from "user" limit 1`;
          return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { status: "unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
