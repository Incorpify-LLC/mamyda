import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Columns3,
  FileText,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  NotebookPen,
  Settings,
  Sun,
  Users,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Title as SheetTitle } from "@radix-ui/react-dialog";
import { ProjectContextPicker } from "@/components/project-context";
import { useBoardMemory } from "@/components/board-context-memory";
import { readPreferences, PREFERENCES_EVENT } from "@/lib/personal-preferences";
import { GlobalSearch } from "@/components/global-search";
import { BOARD_SECTIONS, boardSearchContext, isBoardPath } from "@/lib/board-navigation";

const NAV = [
  { to: "/", label: "Today", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/board", label: "Board", icon: Columns3 },
  { to: "/clients", label: "Clients/Projects", icon: Users },
  { to: "/chat", label: "LLM Chat", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/preferences", label: "Preferences", icon: Settings },
] as const;

function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const location = useRouterState({ select: (s) => s.location });
  const search = location.search;
  const memory = useBoardMemory();
  return (
    <nav className={cn("flex", compact ? "flex-row gap-1" : "flex-col gap-1")}>
      {NAV.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : item.to === "/board"
              ? isBoardPath(pathname)
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            search={
              item.to === "/board"
                ? isBoardPath(pathname)
                  ? boardSearchContext(search)
                  : memory.search
                : {}
            }
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              compact && "flex-col gap-1 px-2 py-1.5 text-[11px]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={compact ? "size-4" : "size-4"} strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  action,
  children,
  boardContext,
  contextDisabled,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  boardContext?: { clientId?: string; projectId?: string };
  contextDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const location = useRouterState({ select: (s) => s.location });
  const search = location.search;
  const memory = useBoardMemory();
  const context =
    boardContext ?? (isBoardPath(pathname) ? boardSearchContext(search) : memory.search);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const preferences = readPreferences(localStorage);
      const next =
        preferences.theme === "dark" || (preferences.theme === "system" && media.matches);
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.dataset.density = preferences.density;
    };
    apply();
    window.addEventListener(PREFERENCES_EVENT, apply);
    window.addEventListener("storage", apply);
    media.addEventListener("change", apply);
    return () => {
      window.removeEventListener(PREFERENCES_EVENT, apply);
      window.removeEventListener("storage", apply);
      media.removeEventListener("change", apply);
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("mamyda-theme", next ? "dark" : "light");
      window.dispatchEvent(new Event(PREFERENCES_EVENT));
    } catch {
      /* Keep the in-session theme. */
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-card/80 px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <p className="font-display text-2xl tracking-tight">Mamyda</p>
          <p className="mt-1 text-xs text-muted-foreground">Your day, stitched.</p>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-border px-1 pt-4">
          <UserButton />
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-30 flex min-w-0 flex-wrap items-center gap-2 border-b border-border bg-background/90 px-3 py-3 backdrop-blur sm:gap-3 sm:px-4 md:flex-nowrap md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="min-w-0 max-w-[40vw] truncate font-display text-xl tracking-tight md:max-w-none md:text-2xl">
            {title}
          </h1>
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <GlobalSearch />
            {action}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              title={dark ? "Use light theme" : "Use dark theme"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>
        <div className="px-4 py-5 pb-24 md:px-8 md:pb-10">
          {isBoardPath(pathname) && (
            <nav
              aria-label="Board sections"
              className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
            >
              {BOARD_SECTIONS.map((section, index) => {
                const Icon = [Columns3, FileText, NotebookPen, FileText, Lock][index];
                const active = pathname === section.to;
                return (
                  <Link
                    key={section.to}
                    to={section.to}
                    search={context}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium sm:px-3",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="hidden size-4 sm:block" aria-hidden="true" />
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {isBoardPath(pathname) && <ProjectContextPicker disabled={contextDisabled} />}
          {children}
        </div>
      </div>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-1 py-1 md:hidden"
      >
        {NAV.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const active =
            item.to === "/"
              ? pathname === "/"
              : item.to === "/board"
                ? isBoardPath(pathname)
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.to === "/board" ? context : {}}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.to === "/clients" ? "Clients" : item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="More navigation"
          aria-expanded={open}
          className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium text-muted-foreground"
        >
          <Menu className="size-4" aria-hidden="true" />
          More
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="pt-12">
          <SheetTitle className="font-display mb-4 px-3 text-2xl">Navigate Mamyda</SheetTitle>
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-6 px-1">
            <UserButton />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function colorDot(color: string): string {
  switch (color) {
    case "ink":
      return "bg-ink";
    case "clay":
      return "bg-clay";
    case "slate":
      return "bg-slate";
    case "olive":
      return "bg-olive";
    default:
      return "bg-sage";
  }
}
