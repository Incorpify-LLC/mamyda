import { createContext, useContext, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { useCurrentUser } from "@/lib/auth/use-current-user";

const DraftContext = createContext<{
  userId?: string;
  scope: string;
  publicKey?: string;
  privateKey?: string;
}>({ scope: "" });
export function EditorDraftProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const ws = useWorkspace();
  const location = useRouterState({ select: (s) => s.location });
  const search = location.search as Record<string, unknown>;
  const scope = JSON.stringify([location.pathname, search.clientId || "", search.projectId || ""]);
  return (
    <DraftContext.Provider
      value={{
        userId: user?.id,
        scope,
        publicKey: ws.data?.profile?.vaultPublicKey || undefined,
        privateKey: ws.data?.profile?.vaultPrivateKeyArmored || undefined,
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}
export function useEditorDraftContext() {
  return useContext(DraftContext);
}
export const EditorDraftContextProvider = DraftContext.Provider;
