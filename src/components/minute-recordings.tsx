import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
  const settings = useQuery({
    queryKey: ["transcription-settings"],
    queryFn: () => getTranscriptionSettings(),
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
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-medium">Recording → minutes</h3>
      <p className="text-xs text-muted-foreground">
        Upload {RECORDING_FORMAT_LABEL} up to 300 MiB and four hours. A progress bar tracks upload;
        conversion continues in the background. Recordings and extracted audio stay in private
        temporary local storage, never MinIO, and expire 15 days after upload starts. Review and
        save minutes before deleting media.
      </p>
      {!settings.data?.enabled || !settings.data?.hasKey ? (
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
          {!ticket && <TurnstileField action="media-upload" resetKey={reset} onToken={setToken} />}
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
      {jobs.isError && (
        <Button type="button" variant="outline" onClick={() => void jobs.refetch()}>
          Retry recording status
        </Button>
      )}
      {(jobs.data ?? [])
        .filter((job) => job.status !== "accepted")
        .map((job) => (
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
      {action && (
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
    </section>
  );
}
