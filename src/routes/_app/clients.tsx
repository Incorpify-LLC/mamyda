import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDialog, ProjectDialog } from "@/components/workspace-managers";
import { useWorkspace } from "@/lib/mamyda/hooks";
import type { Client, Project } from "@/lib/mamyda/types";
export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });
function ClientsPage() {
  const ws = useWorkspace();
  const [client, setClient] = useState<Client | undefined>();
  const [project, setProject] = useState<Project | undefined>();
  const [clientOpen, setClientOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <AppShell
      title="Clients/Projects"
      action={
        <Button
          onClick={() => {
            setClient(undefined);
            setEditing(false);
            setClientOpen(true);
          }}
        >
          New client
        </Button>
      }
    >
      <p className="mb-5 text-sm text-muted-foreground">
        Manage client details and project structure here. Tasks and linked assets live in Board; no
        uploads are needed to create a project.
      </p>
      {ws.isLoading && <p>Loading clients…</p>}
      {ws.isError && (
        <p role="alert">
          Could not load clients.{" "}
          <Button variant="outline" onClick={() => void ws.refetch()}>
            Retry
          </Button>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {ws.data?.clients.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium">{c.name}</h2>
                <p className="text-sm text-muted-foreground">{c.email || "No email added"}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setClient(c);
                  setEditing(true);
                  setClientOpen(true);
                }}
              >
                Edit client
              </Button>
            </div>
            <ul className="my-4 space-y-2">
              {ws.data?.projects
                .filter((p) => p.clientId === c.id)
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div>
                      <Link
                        to="/board"
                        search={{ clientId: c.id, projectId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.description || "No description"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setClient(c);
                        setProject(p);
                        setEditing(true);
                        setProjectOpen(true);
                      }}
                    >
                      Edit project
                    </Button>
                  </li>
                ))}
            </ul>
            <Button
              variant="outline"
              onClick={() => {
                setClient(c);
                setProject(undefined);
                setEditing(false);
                setProjectOpen(true);
              }}
            >
              Add project
            </Button>
          </Card>
        ))}
      </div>
      {ws.isSuccess && !ws.data?.clients.length && (
        <Card className="p-6">
          Start by adding a client, then create its projects. Files, Notes and Minutes can then be
          linked to those projects.
        </Card>
      )}
      <ClientDialog
        open={clientOpen}
        onOpenChange={setClientOpen}
        client={client}
        editing={editing}
        onSaved={() => void ws.refetch()}
      />
      <ProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        client={client}
        project={project}
        editing={editing}
        onSaved={() => void ws.refetch()}
      />
    </AppShell>
  );
}
