import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { LLMChatWorkspace } from "@/components/llm-chat-workspace";
import { listChats, loadChat, saveChat, listChatContext, readChatContext } from "@/lib/mamyda/chat";
import { getLLMSettings, chatWithLLM } from "@/lib/mamyda/llm";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { getPrivateContent } from "@/lib/mamyda/private-content";
import { unlockPrivateKey, decryptNote } from "@/lib/vault-crypto";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

function ChatPage() {
  const ws = useWorkspace();
  const settings = useQuery({ queryKey: ["llm-settings"], queryFn: () => getLLMSettings() });
  const contexts = useQuery({
    queryKey: ["chat-context"],
    queryFn: () => listChatContext(),
    enabled: ws.isSuccess,
  });
  const [search, setSearch] = useState("");
  const archive = useQuery({
    queryKey: ["chats", search],
    queryFn: () => listChats({ data: { search } }),
  });
  async function unlock(kind: "chat" | "task" | "note", id: string, password: string) {
    if (!ws.data?.profile.vaultPrivateKeyArmored || !password)
      throw new Error("Enter the original Vault passphrase to open this content");
    const key = await unlockPrivateKey(ws.data.profile.vaultPrivateKeyArmored, password);
    const cipher = await getPrivateContent({ data: { kind, id } });
    if (key.getFingerprint() !== cipher.fingerprint)
      throw new Error("This content needs a different Vault key");
    return decryptNote(cipher.ciphertext, key);
  }
  return (
    <AppShell title="LLM Chat">
      <LLMChatWorkspace
        settings={settings.data}
        settingsLoading={settings.isPending}
        settingsError={settings.isError}
        retrySettings={() => void settings.refetch()}
        archive={archive.data ?? []}
        archiveLoading={archive.isPending}
        archiveError={archive.isError}
        retryArchive={() => void archive.refetch()}
        contexts={contexts.data ?? []}
        contextsLoading={contexts.isPending}
        contextsError={contexts.isError}
        retryContexts={() => void contexts.refetch()}
        search={search}
        onSearch={setSearch}
        onSaved={() => void archive.refetch()}
        services={{
          load: (id) => loadChat({ data: id }),
          save: (data, token) => saveChat({ data, headers: { "x-turnstile-response": token } }),
          ask: (data, token) => chatWithLLM({ data, headers: { "x-turnstile-response": token } }),
          unlock: (id, password) => unlock("chat", id, password),
          readContext: (item, password) => {
            if (item.encrypted) {
              if (item.kind !== "task" && item.kind !== "note")
                throw new Error("This context cannot be opened here");
              return unlock(item.kind, item.id, password);
            }
            return readChatContext({ data: { kind: item.kind, id: item.id } });
          },
        }}
      />
    </AppShell>
  );
}
