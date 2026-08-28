import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/_app")({
  component: function AppLayout() {
    return (
      <AuthGate>
        <Outlet />
      </AuthGate>
    );
  },
});
