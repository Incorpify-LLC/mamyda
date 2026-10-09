import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PersonalPreferencesPanel } from "@/components/personal-preferences";

export const Route = createFileRoute("/_app/preferences")({ component: PreferencesPage });
function PreferencesPage() {
  return (
    <AppShell title="Preferences">
      <PersonalPreferencesPanel />
    </AppShell>
  );
}
