import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearUnlockedKey } from "@/lib/vault-crypto";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const queryClient = useQueryClient();
  const identity = user?.id ?? null;
  const [activeIdentity, setActiveIdentity] = useState(identity);
  useEffect(() => {
    if (!isPending && activeIdentity !== identity) {
      queryClient.clear();
      clearUnlockedKey();
      setActiveIdentity(identity);
    }
  }, [identity, activeIdentity, isPending, queryClient]);
  if (isPending || activeIdentity !== identity) {
    return (
      <div className="min-h-dvh bg-background px-6 py-10">
        <p className="font-display text-3xl tracking-tight">Mamyda</p>
        <p className="mt-2 text-sm text-muted-foreground">Opening your desk…</p>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <>{children}</>;
}
