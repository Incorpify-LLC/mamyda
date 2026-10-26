export type PersonalPreferences = {
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact";
  taskView: "auto" | "list" | "kanban";
};
export const PREFERENCES_EVENT = "mamyda-preferences-changed";
export const SIDEBAR_COLLAPSED_KEY = "mamyda-sidebar-collapsed";

export function readSidebarCollapsed(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(
  storage: Pick<Storage, "setItem">,
  collapsed: boolean,
): boolean {
  try {
    storage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PREFERENCES_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}
export function readPreferences(storage: Pick<Storage, "getItem">): PersonalPreferences {
  const get = (key: string) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const theme = get("mamyda-theme"),
    density = get("mamyda-density"),
    taskView = get("mamyda-task-view");
  return {
    theme: theme === "light" || theme === "dark" ? theme : "system",
    density: density === "compact" ? "compact" : "comfortable",
    taskView: taskView === "list" || taskView === "kanban" ? taskView : "auto",
  };
}
export function savePreferences(value: PersonalPreferences) {
  try {
    localStorage.setItem("mamyda-theme", value.theme);
    localStorage.setItem("mamyda-density", value.density);
    if (value.taskView === "auto") localStorage.removeItem("mamyda-task-view");
    else localStorage.setItem("mamyda-task-view", value.taskView);
    window.dispatchEvent(new Event(PREFERENCES_EVENT));
    return true;
  } catch {
    return false;
  }
}
