import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "primary" | "warn" | "danger" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "warn" && "bg-amber-100 text-amber-900",
        tone === "danger" && "bg-red-100 text-red-900",
        tone === "ok" && "bg-emerald-100 text-emerald-900",
        className,
      )}
      {...props}
    />
  );
}
