import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  readPreferences,
  savePreferences,
  type PersonalPreferences,
} from "@/lib/personal-preferences";

export function PersonalPreferencesPanel() {
  const [value, setValue] = useState<PersonalPreferences>({
    theme: "system",
    density: "comfortable",
    taskView: "auto",
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    setValue(readPreferences(localStorage));
  }, []);
  function update(next: PersonalPreferences) {
    setValue(next);
    setMessage(
      savePreferences(next)
        ? "Saved on this browser."
        : "Browser storage is unavailable. Preferences could not be saved.",
    );
  }
  return (
    <section
      aria-label="Personal display preferences"
      className="max-w-xl space-y-5 rounded-lg border bg-card p-4"
    >
      <p className="text-sm text-muted-foreground">
        These choices apply to this browser, not your teammates. Workspace integrations remain in
        Settings. No security check is needed for local display preferences.
      </p>
      <Label className="block space-y-2">
        Theme
        <select
          aria-label="Theme"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={value.theme}
          onChange={(e) =>
            update({ ...value, theme: e.target.value as PersonalPreferences["theme"] })
          }
        >
          <option value="system">Follow device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Label>
      <Label className="block space-y-2">
        Task spacing
        <select
          aria-label="Task spacing"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={value.density}
          onChange={(e) =>
            update({ ...value, density: e.target.value as PersonalPreferences["density"] })
          }
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </Label>
      <Label className="block space-y-2">
        Default task view
        <select
          aria-label="Default task view"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={value.taskView}
          onChange={(e) =>
            update({ ...value, taskView: e.target.value as PersonalPreferences["taskView"] })
          }
        >
          <option value="auto">Automatic: mobile list, desktop Kanban</option>
          <option value="list">Grouped list</option>
          <option value="kanban">Kanban</option>
        </select>
      </Label>
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  );
}
