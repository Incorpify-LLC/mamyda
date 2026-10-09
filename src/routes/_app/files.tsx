import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { useProjectContext } from "@/components/project-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TurnstileField } from "@/components/turnstile-field";
import { boardSearchContext } from "@/lib/board-navigation";
import {
  fileExtension,
  sortFiles,
  validateFileSelection,
  type FileSort,
} from "@/lib/file-experience";
import { transferFile } from "@/lib/file-transfer";
import { useWorkspace } from "@/lib/mamyda/hooks";
import { listClientFiles, reserveFileBatch, deleteClientFile } from "@/lib/mamyda/files";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/files")({
  validateSearch: boardSearchContext,
  component: FilesPage,
});
type QueueItem = {
  file: File;
  id?: string;
  url?: string;
  progress: number;
  status: "Queued" | "Uploading" | "Saving" | "Uploaded" | "Failed";
  error?: string;
};
function FilesPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const ws = useWorkspace();
  const context = useProjectContext(true);
  const { client, project } = context;
  const listing = useQuery({
    queryKey: ["files", client?.id],
    enabled: Boolean(client),
    queryFn: () => listClientFiles({ data: client!.id }),
  });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [sort, setSort] = useState<FileSort>("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [legacy, setLegacy] = useState(true);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deleteToken, setDeleteToken] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteReset, setDeleteReset] = useState(0);
  useEffect(() => {
    setQueue([]);
    setToken("");
    setReset((value) => value + 1);
  }, [client?.id, project?.id]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function update(index: number, values: Partial<QueueItem>) {
    setQueue((current) => current.map((item, i) => (i === index ? { ...item, ...values } : item)));
  }
  async function send(item: QueueItem, index: number) {
    try {
      update(index, { status: "Uploading", progress: 0, error: undefined });
      await transferFile(item.url!, item.file, (value) =>
        update(index, { progress: value, status: value === 100 ? "Saving" : "Uploading" }),
      );
      update(index, { status: "Uploaded", progress: 100 });
    } catch (error) {
      update(index, {
        status: "Failed",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }
  async function upload() {
    if (!client || !project || busy) return;
    setBusy(true);
    try {
      const tickets = await reserveFileBatch({
        data: {
          clientId: client.id,
          projectId: project.id,
          files: queue.map((item) => ({
            name: item.file.name,
            size: item.file.size,
            contentType: item.file.type || "application/octet-stream",
          })),
        },
        headers: { "x-turnstile-response": token },
      });
      const reserved = queue.map((item, i) => ({ ...item, ...tickets[i] }));
      setQueue(reserved);
      for (let i = 0; i < reserved.length; i++) await send(reserved[i], i);
      await listing.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start upload");
    } finally {
      setBusy(false);
      setToken("");
      setReset((n) => n + 1);
    }
  }
  async function retry(item: QueueItem, index: number) {
    setBusy(true);
    try {
      await send(item, index);
      await listing.refetch();
    } finally {
      setBusy(false);
    }
  }
  function order(value: FileSort) {
    if (sort === value) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(value);
      setDirection("asc");
    }
  }
  const rows = sortFiles(
    (listing.data ?? []).filter(
      (row) => row.project_id === project?.id || (legacy && !row.project_id),
    ),
    sort,
    direction,
  );
  return (
    <AppShell title="Files" boardContext={context.search} contextDisabled={busy}>
      <p className="mb-4 text-sm text-muted-foreground">
        Files belong to a client and project. Manage their details in{" "}
        <Link to="/clients" className="underline">
          Clients/Projects
        </Link>
        . These uploads are not Vault-encrypted; optional project-key encryption is being prepared
        separately.
      </p>
      {ws.isError && (
        <p role="alert">
          Could not load projects. <Button onClick={() => void ws.refetch()}>Retry</Button>
        </p>
      )}
      {!project && (
        <Card className="mb-4 p-4">
          Create a client and project in Clients/Projects before uploading.
        </Card>
      )}
      <Card className="mb-5 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer disabled:cursor-not-allowed"
            disabled={busy || !project}
            aria-controls="file-selection"
            onClick={() => fileInput.current?.click()}
          >
            Select files
          </Button>
          <p id="file-selection-help" className="text-sm text-muted-foreground">
            Up to 20 files; 24 MiB per file
          </p>
        </div>
        <input
          ref={fileInput}
          id="file-selection"
          aria-label="Select files"
          aria-describedby="file-selection-help"
          type="file"
          multiple
          disabled={busy || !project}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            try {
              validateFileSelection(files);
              setQueue(files.map((file) => ({ file, progress: 0, status: "Queued" })));
            } catch (error) {
              toast.error((error as Error).message);
            }
            e.target.value = "";
          }}
        />
        {queue.length > 0 && (
          <ul className="space-y-3">
            {queue.map((item, index) => (
              <li key={`${index}-${item.file.name}`} className="min-w-0 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="break-all">{item.file.name}</span>
                  <span aria-live="polite">
                    {item.status}
                    {item.status === "Uploading" ? ` ${item.progress}%` : ""}
                  </span>
                </div>
                <progress
                  className="w-full accent-primary"
                  max={100}
                  value={item.status === "Uploaded" ? 100 : Math.min(item.progress, 99)}
                  aria-label={`Upload progress for ${item.file.name}`}
                />
                {item.error && (
                  <p role="alert" className="text-destructive">
                    {item.error}
                  </p>
                )}
                {item.status === "Failed" && item.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void retry(item, index)}
                  >
                    Retry file
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {queue.length > 0 && queue.every((item) => !item.id) && (
          <>
            <TurnstileField action="file-upload" resetKey={reset} onToken={setToken} />
            <Button disabled={busy || !token || !project} onClick={() => void upload()}>
              {busy ? "Uploading…" : `Upload ${queue.length} file${queue.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
        {busy && (
          <p role="status" className="text-xs text-muted-foreground">
            Keep this page open until all files are saved.
          </p>
        )}
      </Card>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} />
        Include older client-level files (not yet assigned to a project)
      </label>
      {listing.isError && (
        <p role="alert">
          Could not load files. <Button onClick={() => void listing.refetch()}>Retry</Button>
        </p>
      )}
      {listing.isLoading ? (
        <p>Loading files…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Project files. Click a column heading to sort.</caption>
            <thead>
              <tr>
                {(
                  [
                    ["name", "Name"],
                    ["extension", "Extension"],
                    ["size", "Size"],
                    ["date", "Uploaded"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    className="p-3"
                    aria-sort={
                      sort === key ? (direction === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <button onClick={() => order(key)}>
                      {label} {sort === key ? (direction === "asc" ? "↑" : "↓") : "↕"}
                    </button>
                  </th>
                ))}
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="max-w-64 break-words p-3">
                    {row.name}
                    {!row.project_id && (
                      <p className="text-xs text-muted-foreground">Client-level legacy</p>
                    )}
                  </td>
                  <td className="p-3">{fileExtension(row.name).toUpperCase()}</td>
                  <td className="whitespace-nowrap p-3">
                    {(row.byte_size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                    KiB
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <a href={`/api/files/${encodeURIComponent(row.id)}`} className="mr-3 underline">
                      Download
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setDeleting(row);
                        setDeleteToken("");
                        setDeleteReset((n) => n + 1);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listing.isError && (
                <tr>
                  <td colSpan={5} className="p-5 text-muted-foreground">
                    No files for this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete file?</DialogTitle>
          <p className="break-all">
            Delete {deleting?.name}? This removes the stored object and cannot be undone through
            Mamyda.
          </p>
          <TurnstileField action="file-delete" resetKey={deleteReset} onToken={setDeleteToken} />
          <Button
            variant="destructive"
            disabled={!deleteToken || deleteBusy}
            onClick={async () => {
              if (!deleting) return;
              setDeleteBusy(true);
              try {
                await deleteClientFile({
                  data: deleting.id,
                  headers: { "x-turnstile-response": deleteToken },
                });
                setDeleting(null);
                await listing.refetch();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not delete file");
              } finally {
                setDeleteBusy(false);
                setDeleteToken("");
                setDeleteReset((n) => n + 1);
              }
            }}
          >
            {deleteBusy ? "Deleting…" : "Delete file"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
