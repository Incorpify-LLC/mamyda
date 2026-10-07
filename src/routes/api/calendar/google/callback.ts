import { createFileRoute } from "@tanstack/react-router";
import { completeCalendarOAuth } from "@/lib/mamyda/calendar-oauth.server";

export const Route = createFileRoute("/api/calendar/google/callback")({
  server: { handlers: { GET: ({ request }) => completeCalendarOAuth("google", request) } },
});
