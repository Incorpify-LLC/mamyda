import { createFileRoute } from "@tanstack/react-router";
import { completeCalendarOAuth } from "@/lib/mamyda/calendar-oauth.server";

/** Public Microsoft callback registered in the Entra application. */
export const Route = createFileRoute("/api/calendar/microsoft/callback")({
  server: { handlers: { GET: ({ request }) => completeCalendarOAuth("outlook", request) } },
});
