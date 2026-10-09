import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useVerifiedToken } from "@/components/submission-verification";
import { colorDot } from "@/components/app-shell";
import { CLIENT_COLORS } from "@/lib/columns";
import { archiveClient, archiveProject, upsertClient, upsertProject } from "@/lib/mamyda/workspace";
import type { Client, Project } from "@/lib/mamyda/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ClientDialog({
  open,
  onOpenChange,
  client,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
  editing: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("sage");
  const [creating, setCreating] = useState(true);
  const verify = useVerifiedToken();
  const [busy, setBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCreating(!editing);
    setName(editing ? (client?.name ?? "") : "");
    setEmail(editing ? (client?.email ?? "") : "");
    setColor(editing ? (client?.color ?? "sage") : "sage");
  }, [client, editing, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>{creating ? "New client" : "Edit client"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setSubmissionError("");
            try {
              const captcha = await verify("client-manage", "Saving details");
              await upsertClient({
                data: {
                  id: creating ? undefined : client?.id,
                  name,
                  email,
                  color,
                },
                headers: captcha ? { "x-turnstile-response": captcha } : undefined,
              });
              toast.success(creating ? "Client added" : "Client saved");
              onOpenChange(false);
              onSaved();
            } catch (error) {
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : "Submission failed. Your draft is unchanged.",
              );
              toast.error(error instanceof Error ? error.message : "Could not save client");
            } finally {
              setBusy(false);
            }
          }}
        >
          {submissionError && (
            <p role="alert" className="text-sm text-destructive">
              {submissionError} Retry when ready.
            </p>
          )}
          <fieldset disabled={busy} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cname">Name</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cemail">Email</Label>
              <Input
                id="cemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full",
                    colorDot(c),
                    color === c && "ring-2 ring-ring ring-offset-2",
                  )}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="flex justify-between pt-2">
              {!creating && client && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (busy || !window.confirm("Archive this item?")) return;
                    setBusy(true);
                    setSubmissionError("");
                    try {
                      const captcha = await verify("client-manage", "Archiving item");
                      await archiveClient({
                        data: client.id,
                        headers: captcha ? { "x-turnstile-response": captcha } : undefined,
                      });
                      onOpenChange(false);
                      onSaved();
                    } catch (error) {
                      setSubmissionError(
                        error instanceof Error
                          ? error.message
                          : "Submission failed. Your draft is unchanged.",
                      );
                      toast.error(
                        error instanceof Error ? error.message : "Could not archive client",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Archive
                </Button>
              )}
              <Button type="submit" className="ml-auto">
                Save
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDialog({
  open,
  onOpenChange,
  client,
  project,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: Client;
  project?: Project;
  editing: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(true);
  const verify = useVerifiedToken();
  const [busy, setBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCreating(!editing);
    setName(editing ? (project?.name ?? "") : "");
    setDescription(editing ? (project?.description ?? "") : "");
  }, [editing, open, project]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>{creating ? "New project" : "Edit project"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!client) return;
            if (busy) return;
            setBusy(true);
            setSubmissionError("");
            try {
              const captcha = await verify("project-manage", "Saving details");
              await upsertProject({
                data: {
                  id: creating ? undefined : project?.id,
                  clientId: client.id,
                  name,
                  description,
                },
                headers: captcha ? { "x-turnstile-response": captcha } : undefined,
              });
              toast.success("Project saved");
              onOpenChange(false);
              onSaved();
            } catch (error) {
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : "Submission failed. Your draft is unchanged.",
              );
              toast.error(error instanceof Error ? error.message : "Could not save project");
            } finally {
              setBusy(false);
            }
          }}
        >
          {submissionError && (
            <p role="alert" className="text-sm text-destructive">
              {submissionError} Retry when ready.
            </p>
          )}
          <fieldset disabled={busy} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdesc">Description</Label>
              <Textarea
                id="pdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-between pt-2">
              {!creating && project && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (busy || !window.confirm("Archive this item?")) return;
                    setBusy(true);
                    setSubmissionError("");
                    try {
                      const captcha = await verify("project-manage", "Archiving item");
                      await archiveProject({
                        data: project.id,
                        headers: captcha ? { "x-turnstile-response": captcha } : undefined,
                      });
                      onOpenChange(false);
                      onSaved();
                    } catch (error) {
                      setSubmissionError(
                        error instanceof Error
                          ? error.message
                          : "Submission failed. Your draft is unchanged.",
                      );
                      toast.error(
                        error instanceof Error ? error.message : "Could not archive project",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Archive
                </Button>
              )}
              <Button type="submit" className="ml-auto">
                Save
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
