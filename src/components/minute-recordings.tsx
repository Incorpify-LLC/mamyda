import { Link } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TurnstileField } from "@/components/turnstile-field";
import {
  getTranscriptionSettings,
  listMediaJobs,
  reserveMediaUpload,
  acceptMediaTranscript,
  discardMediaRecording,
} from "@/lib/mamyda/media";
import { transferRecording } from "@/lib/media-transfer";
import { recordingSelectionError } from "@/lib/media-config";
import { RECORDING_ACCEPT, RECORDING_FORMAT_LABEL } from "../../scripts/media-formats";
import { toast } from "sonner";
export function MinuteRecordings({
  onTranscript,
  onBusyChange,
  canAccept,
  disabled,
}: {
  onTranscript: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
  canAccept: boolean;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const settings = useQuery({
    queryKey: ["transcription-settings"],
    queryFn: () => getTranscriptionSettings(),
    enabled: expanded,
  });
  const jobs = useQuery({
    queryKey: ["media-jobs"],
    queryFn: () => listMediaJobs(),
    refetchInterval: 5000,
  });
  const [file, setFile] = useState<File | null>(null),
    [recordingError, setRecordingError] = useState<string | null>(null),
    [ticket, setTicket] = useState<{ id: string; url: string } | null>(null),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  const [action, setAction] = useState<{ id: string; kind: "accept" | "delete" } | null>(null),
    [actionToken, setActionToken] = useState(""),
    [actionReset, setActionReset] = useState(0);
  const visibleJobs = (jobs.data ?? []).filter((job) => job.status !== "accepted");
  const ready = visibleJobs.filter((job) => job.status === "ready").length;
  const processing = visibleJobs.filter((job) =>
    ["queued", "processing"].includes(job.status),
  ).length;
  const failed = visibleJobs.filter((job) => job.status === "error").length;
  async function upload() {
    if (!file) return;
    setRecordingError(null);
    setBusy(true);
    onBusyChange(true);
    try {
      let current = ticket;
      if (!current) {
        current = await reserveMediaUpload({
          data: { name: file.name, size: file.size, consent: true },
          headers: { "x-turnstile-response": token },
        });
        setTicket(current);
        setToken("");
        setReset((value) => value + 1);
      }
      const rows = await listMediaJobs();
      const row = rows.find((item) => item.id === current!.id);
      if (!row) throw new Error("Upload expired; select the recording again");
      if (row.status === "uploading")
        await transferRecording(current.url, file, setProgress, row.next_chunk);
      else if (!["queued", "processing", "ready"].includes(row.status))
        throw new Error("This recording failed; select it again to start another job");
      setProgress(100);
      setFile(null);
      setTicket(null);
      setConsent(false);
      await jobs.refetch();
      toast.success("Upload complete — transcription is queued");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recording upload failed; retry available";
      setRecordingError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      onBusyChange(false);
      setToken("");
      setReset((value) => value + 1);
    }
  }
  return (
    <section aria-label="Recording tools" className="space-y-2 rounded-md border p-3">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={busy}
        className="flex min-h-10 w-full items-center justify-between gap-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setExpanded((value) => !value);
          setConsent(false);
          setToken("");
          setReset((value) => value + 1);
          setAction(null);
          setActionToken("");
        }}
      >
        Transcribe a recording
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <p className="text-xs text-muted-foreground">
        MP3, MP4, WAV and more · 300 MiB · up to 4 hours
      </p>
      {(ready > 0 || processing > 0 || busy) && (
        <p role="status" className="text-sm">
          {busy
            ? `Uploading ${progress}%`
            : ready
              ? `${ready} transcript${ready === 1 ? "" : "s"} ready`
              : `${processing} recording${processing === 1 ? "" : "s"} converting`}
        </p>
      )}
      {jobs.isError && !expanded && (
        <p role="alert" className="text-sm text-destructive">
          Could not load recording status. Expand recording tools to retry.
        </p>
      )}
      {failed > 0 && !expanded && (
        <p role="alert" className="text-sm text-destructive">
          {failed} recording{failed === 1 ? "" : "s"} failed. Expand recording tools to review; paid
          calls are not retried automatically.
        </p>
      )}
      <div id={panelId} hidden={!expanded} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Temporary media is automatically deleted after 15 days. Review and save the transcript
          before deleting a recording.
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Supported formats and storage</summary>
          <p className="mt-2">
            {RECORDING_FORMAT_LABEL}. Recordings and extracted audio stay in private temporary local
            storage, never MinIO. Conversion continues in the background; retention starts when
            upload starts.
          </p>
        </details>
        {settings.isPending && (
          <p role="status" className="text-sm">
            Loading transcription configuration…
          </p>
        )}
        {settings.isError && (
          <p role="alert" className="text-sm text-destructive">
            Could not load transcription configuration.{" "}
            <button type="button" className="underline" onClick={() => void settings.refetch()}>
              Retry configuration
            </button>
          </p>
        )}
        {settings.isSuccess && (!settings.data?.enabled || !settings.data?.hasKey) ? (
          <p className="text-sm">
            <Link to="/settings" search={{ section: "llm" }} className="underline">
              Configure recording transcription in Settings → LLM
            </Link>
          </p>
        ) : null}
        <input
          ref={input}
          type="file"
          accept={RECORDING_ACCEPT}
          disabled={disabled || busy}
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (!selected || disabled || busy) return;
            const selectionError = recordingSelectionError(selected);
            if (selectionError) {
              setRecordingError(selectionError);
              setFile(null);
              setTicket(null);
              setConsent(false);
              setProgress(0);
              setToken("");
              setReset((value) => value + 1);
              toast.error(selectionError);
              e.target.value = "";
              return;
            }
            setRecordingError(null);
            setFile(selected);
            setTicket(null);
            setProgress(0);
            setConsent(false);
            setToken("");
            setReset((value) => value + 1);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {file ? "Change recording" : "Select recording"}
        </Button>
        {recordingError && (
          <p role="alert" className="text-sm text-destructive">
            {recordingError}
          </p>
        )}
        {file && (
          <div className="space-y-2">
            <p className="break-words text-sm">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
            </p>
            <p className="text-xs text-muted-foreground" role="status">
              Recording selected. Confirm permission below, then choose Upload and transcribe.
              Selection alone does not start an upload.
            </p>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={consent}
                disabled={disabled || busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Send extracted audio to OpenAI / {settings.data?.model} for transcription. API charges
              and provider retention policies apply. Do not upload recordings without appropriate
              participant permission.
            </label>
            {expanded && !ticket && (
              <TurnstileField action="media-upload" resetKey={reset} onToken={setToken} />
            )}
            <Button
              type="button"
              size="sm"
              disabled={
                disabled ||
                busy ||
                !consent ||
                (!ticket && !token) ||
                !settings.data?.enabled ||
                !settings.data.hasKey
              }
              onClick={() => void upload()}
            >
              {busy ? "Uploading…" : ticket ? "Resume upload" : "Upload and transcribe"}
            </Button>
            <progress
              aria-label="Recording upload progress"
              className="w-full"
              value={progress}
              max={100}
            />
            <p className="text-xs">
              Upload: {progress}%{progress === 100 ? " · awaiting conversion" : ""}
            </p>
          </div>
        )}
        {jobs.isPending && (
          <p role="status" className="text-sm">
            Loading recording status…
          </p>
        )}
        {jobs.isSuccess && visibleJobs.length === 0 && (
          <p className="text-sm text-muted-foreground">No temporary recordings yet.</p>
        )}
        {jobs.isError && (
          <div>
            <p role="alert" className="mb-2 text-sm text-destructive">
              Could not load recording status. Existing recordings have not been removed.
            </p>
            <Button type="button" variant="outline" onClick={() => void jobs.refetch()}>
              Retry recording status
            </Button>
          </div>
        )}
        {visibleJobs.map((job) => (
          <div className="space-y-2 rounded-md bg-muted p-3" key={job.id}>
            <p className="break-words text-sm font-medium">{job.name}</p>
            <p className="text-xs text-muted-foreground">
              {job.status}
              {job.status === "processing" ? ` · converted segments ${job.progress}%` : ""} ·
              automatic deletion {new Date(job.expires_at).toLocaleDateString()}
            </p>
            {job.error && (
              <p role="alert" className="text-sm text-destructive">
                {job.error}
              </p>
            )}
            {job.status === "ready" && (
              <>
                <details>
                  <summary className="cursor-pointer text-sm">Review transcript</summary>
                  <p className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-sm">
                    {job.transcript}
                  </p>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled || busy}
                    onClick={() => onTranscript(job.transcript)}
                  >
                    Add transcript to minutes draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || busy || !canAccept}
                    onClick={() => {
                      setAction({ id: job.id, kind: "accept" });
                      setActionToken("");
                      setActionReset((value) => value + 1);
                    }}
                  >
                    Reviewed OK — delete recording
                  </Button>
                </div>
                {!canAccept && (
                  <p className="text-xs text-muted-foreground">
                    Save the minutes before marking OK and deleting the original recording.
                  </p>
                )}
              </>
            )}
            {!["processing", "ready"].includes(job.status) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || busy}
                onClick={() => {
                  setAction({ id: job.id, kind: "delete" });
                  setActionToken("");
                  setActionReset((value) => value + 1);
                }}
              >
                Discard temporary recording
              </Button>
            )}
          </div>
        ))}
        {expanded && action && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              Delete this temporary recording and derived audio permanently?{" "}
              {action.kind === "accept"
                ? "The temporary transcript will also be cleared; saved minutes are retained."
                : "The queued conversion will be cancelled."}
            </p>
            <TurnstileField
              action={action.kind === "accept" ? "media-accept" : "media-delete"}
              resetKey={actionReset}
              onToken={setActionToken}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!actionToken || disabled || busy}
                onClick={async () => {
                  setBusy(true);
                  onBusyChange(true);
                  try {
                    if (action.kind === "accept")
                      await acceptMediaTranscript({
                        data: action.id,
                        headers: { "x-turnstile-response": actionToken },
                      });
                    else
                      await discardMediaRecording({
                        data: action.id,
                        headers: { "x-turnstile-response": actionToken },
                      });
                    setAction(null);
                    await jobs.refetch();
                    toast.success("Temporary recording and audio removed; deletion is permanent");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not delete recording",
                    );
                  } finally {
                    setBusy(false);
                    onBusyChange(false);
                    setActionToken("");
                    setActionReset((value) => value + 1);
                  }
                }}
              >
                Confirm permanent deletion
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
