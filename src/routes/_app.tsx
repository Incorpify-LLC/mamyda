import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { BoardContextMemory } from "@/components/board-context-memory";
import { useCurrentUser } from "@/lib/auth/use-current-user";

function WorkspaceNavigation() {
  const user = useCurrentUser();
  return (
    <BoardContextMemory key={user?.id ?? "signed-out"}>
      <Outlet />
    </BoardContextMemory>
  );
}

export const Route = createFileRoute("/_app")({
  component: function AppLayout() {
    return (
      <AuthGate>
        <WorkspaceNavigation />
      </AuthGate>
    );
  },
});
