// Dev-only UI fixture: no LLM provider, archive writes or real decryption.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SubmissionVerificationProvider } from "@/components/submission-verification";
import { ClientDialog, ProjectDialog } from "@/components/workspace-managers";
import { ProjectTaskBoard } from "@/components/project-task-board";
import type { Task } from "@/lib/mamyda/types";
import { MinuteRecordings } from "@/components/minute-recordings";
import { ContentProtection } from "@/components/content-protection";
import { VaultOverview } from "@/components/vault-overview";
import { EditorFeedback } from "@/components/editor-feedback";
import type { Profile } from "@/lib/mamyda/types";
import {
  LLMChatWorkspace,
  type ChatServices,
  type LoadedChat,
} from "@/components/llm-chat-workspace";
import type { ChatMeta } from "@/lib/mamyda/chat.server";
import "@/styles.css";

const qa = { asks: [] as unknown[], saves: [] as unknown[], failNext: false };
const fixtureWindow = window as unknown as {
  __verificationQA?: { calls: unknown[]; failNext: boolean };
};
fixtureWindow.__verificationQA ??= { calls: [], failNext: false };
(window as unknown as { __chatQA: typeof qa }).__chatQA = qa;
const legacy: LoadedChat = {
  id: "legacy",
  date: "2000-01-01",
  title: "Protected earlier chat",
  tags: ["history"],
  revision: 1,
  encrypted: true,
  body: "",
};
const legacyText = JSON.stringify({
  version: 1,
  messages: [
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Previously encrypted reply." },
  ],
});
const rows = new Map<string, LoadedChat>([[legacy.id, legacy]]);

function Fixture() {
  const [search, setSearch] = useState(""),
    [generation, refresh] = useState(0);
  const archive: ChatMeta[] = Array.from(rows.values())
    .filter((row) =>
      `${row.title} ${row.date} ${row.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase()),
    )
    .map((row) => ({ ...row, chat_date: row.date }));
  const services: ChatServices = {
    load: async (id) => rows.get(id)!,
    save: async (data, token) => {
      qa.saves.push({ data, token });
      const row = {
        ...data,
        id: data.id ?? "saved",
        encrypted: false,
        revision: data.revision + 1,
      };
      rows.set(row.id, row);
      return row;
    },
    ask: async (data, token) => {
      qa.asks.push({ data, token });
      if (qa.failNext) {
        qa.failNext = false;
        throw new Error("Fixture provider failure.");
      }
      return { text: "A clear answer using the attached context." };
    },
    readContext: async (item, password) => {
      if (item.encrypted && password !== "fixture-passphrase") throw new Error("Wrong passphrase");
      return "A readable project excerpt.";
    },
    unlock: async (_id, password) => {
      if (password !== "fixture-passphrase") throw new Error("Wrong passphrase");
      return legacyText;
    },
  };
  void generation;
  if (new URLSearchParams(window.location.search).has("editor"))
    return (
      <AppShell title="Editor safety">
        <VaultOverview />
        <ContentProtection
          profile={
            {
              vaultPublicKey: "fixture-public-key",
              vaultPrivateKeyArmored: "fixture-private-key",
            } as Profile
          }
          kind="note"
          id="fixture-note"
          encrypted
          enabled
          unlocked={false}
          onToggle={() => {}}
          onUnlock={() => {
            throw new Error("Unexpected decrypt");
          }}
          onLock={() => {}}
        />
        <EditorFeedback
          loading={false}
          error={false}
          empty
          emptyText="No saved notes yet."
          onRetry={() => {}}
        />
      </AppShell>
    );
  if (new URLSearchParams(window.location.search).has("verification"))
    return <VerificationFixture />;
  if (new URLSearchParams(window.location.search).has("board")) return <BoardFixture />;
  if (new URLSearchParams(window.location.search).has("recording"))
    return (
      <AppShell title="Minutes">
        <MinuteRecordings
          onTranscript={() => {}}
          onBusyChange={() => {}}
          canAccept={false}
          disabled={false}
        />
      </AppShell>
    );
  return (
    <AppShell title="LLM Chat">
      <LLMChatWorkspace
        settings={{
          provider: "openai",
          model: "fixture-model",
          enabled: true,
          hasKey: true,
          maxTokens: 2048,
          source: "personal",
        }}
        settingsLoading={false}
        settingsError={false}
        retrySettings={() => {}}
        archive={archive}
        archiveLoading={false}
        archiveError={false}
        retryArchive={() => {}}
        contexts={[
          { id: "task", kind: "task", title: "Project task", encrypted: false },
          { id: "note", kind: "note", title: "Protected note", encrypted: true },
        ]}
        contextsLoading={false}
        contextsError={false}
        retryContexts={() => {}}
        search={search}
        onSearch={setSearch}
        onSaved={() => refresh((value) => value + 1)}
        services={services}
      />
    </AppShell>
  );
}
function VerificationFixture() {
  const [open, setOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  return (
    <AppShell title="Clients/Projects">
      <button type="button" onClick={() => setOpen(true)}>
        New client
      </button>
      <button type="button" onClick={() => setProjectOpen(true)}>
        New project
      </button>
      <p role="status">Saved {saved}</p>
      <ClientDialog
        open={open}
        onOpenChange={setOpen}
        editing={false}
        onSaved={() => setSaved((n) => n + 1)}
      />
      <ProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        editing={false}
        client={{
          id: "client",
          name: "Example",
          email: null,
          color: "sage",
          archived: false,
          createdAt: "2026-10-09",
        }}
        onSaved={() => setSaved((n) => n + 1)}
      />
    </AppShell>
  );
}
function BoardFixture() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "one",
      projectId: "project",
      title: "Review a very long project task title with a detailed client request",
      notes: null,
      columnId: "doing",
      priority: "high",
      dueAt: null,
      labels: [],
      position: 1,
      isSample: false,
      createdAt: "2026-10-09",
      encrypted: true,
    },
  ]);
  const [result, setResult] = useState("");
  const [fail, setFail] = useState(false);
  return (
    <AppShell title="Board">
      <h2 className="mb-4 font-display text-xl">Example client / Project</h2>
      <ProjectTaskBoard
        tasks={tasks}
        onOpen={(task) => setResult("Opened " + task.id)}
        onCreate={(status) => setResult("Create " + status)}
        onMove={async (id, status) => {
          if (fail) throw new Error("Fixture failure");
          setTasks((rows) =>
            rows.map((row) => (row.id === id ? { ...row, columnId: status } : row)),
          );
        }}
      />
      <p role="status">{result}</p>
      <button type="button" onClick={() => setFail(!fail)}>
        Toggle move failure
      </button>
      <button type="button" onClick={() => setTasks([])}>
        Empty project
      </button>
    </AppShell>
  );
}
const rootRoute = createRootRoute({ component: Fixture });
const route = createRoute({ getParentRoute: () => rootRoute, path: "/chat" });
const boardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/board" });
const router = createRouter({
  routeTree: rootRoute.addChildren([route, boardRoute]),
  history: createMemoryHistory({
    initialEntries: [new URLSearchParams(window.location.search).has("board") ? "/board" : "/chat"],
  }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <SubmissionVerificationProvider>
      <RouterProvider router={router} />
    </SubmissionVerificationProvider>
    <Toaster />
  </QueryClientProvider>,
);
