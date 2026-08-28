import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Columns3,
  FileText,
  LayoutDashboard,
  Lock,
  Menu,
  NotebookPen,
  Settings,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Today", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/board", label: "Board", icon: Columns3 },
  { to: "/minutes", label: "Minutes", icon: FileText },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({
  onNavigate,
  compact,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className={cn("flex", compact ? "flex-row gap-1" : "flex-col gap-1")}>
      {NAV.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
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
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="font-display text-xl tracking-tight md:text-2xl">
            {title}
          </h1>
          <div className="ml-auto flex items-center gap-2">{action}</div>
        </header>
        <div className="px-4 py-5 pb-24 md:px-8 md:pb-10">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-1 py-1 md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-w-12 flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium text-muted-foreground"
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="pt-12">
          <p className="font-display mb-4 px-3 text-2xl">Mamyda</p>
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
