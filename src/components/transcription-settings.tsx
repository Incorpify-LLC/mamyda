import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTranscriptionSettings, saveTranscriptionSettings } from "@/lib/mamyda/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVerifiedToken } from "@/components/submission-verification";
import { toast } from "sonner";
export function TranscriptionSettings() {
  const query = useQuery({
    queryKey: ["transcription-settings"],
    queryFn: () => getTranscriptionSettings(),
  });
  const [model, setModel] = useState("gpt-transcribe"),
    [enabled, setEnabled] = useState(false),
    [key, setKey] = useState(""),
    [clear, setClear] = useState(false),
    [busy, setBusy] = useState(false);
  const verify = useVerifiedToken();
  const [submissionError, setSubmissionError] = useState("");
  useEffect(() => {
    if (query.data) {
      setModel(query.data.model);
      setEnabled(query.data.enabled);
    }
  }, [query.data]);
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-medium">Recording transcription (OpenAI API)</h3>
      <p className="text-xs text-muted-foreground">
        MP3/MP4 transcription uses a speech-to-text model, not the chat model above. Choose one of
        the supported transcription models and provide an OpenAI API key with access. Unsupported
        model IDs are rejected before upload or processing; saving does not make a paid call.
        Recordings are temporarily stored locally, sent to OpenAI only with consent, and deleted
        after acceptance or 15 days. Provider retention policies still apply.
      </p>
      {query.isError ? (
        <Button onClick={() => void query.refetch()}>Retry configuration</Button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setSubmissionError("");
            try {
              const token = await verify("transcription-settings", "Saving transcription settings");
              await saveTranscriptionSettings({
                data: { model, enabled, apiKey: key, clearKey: clear },
                headers: { "x-turnstile-response": token },
              });
              setKey("");
              setClear(false);
              await query.refetch();
              toast.success("Transcription settings saved; provider access is not tested");
            } catch (error) {
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : "Submission failed. Your draft is unchanged.",
              );
              toast.error(
                error instanceof Error ? error.message : "Could not save transcription settings",
              );
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
          <fieldset disabled={busy || query.isLoading} className="space-y-3">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enable recording transcription
            </label>
            <Label htmlFor="transcription-model">Speech-to-text model</Label>
            <select
              id="transcription-model"
              aria-label="Speech-to-text model"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            >
              <option value="gpt-transcribe">GPT Transcribe</option>
              <option value="gpt-4o-transcribe">GPT-4o Transcribe</option>
              <option value="gpt-4o-mini-transcribe">GPT-4o Mini Transcribe</option>
              <option value="whisper-1">Whisper-1</option>
            </select>
            <Label htmlFor="transcription-key">OpenAI transcription API key</Label>
            <Input
              id="transcription-key"
              type="password"
              autoComplete="new-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                query.data?.hasKey ? "Key configured — leave blank to keep it" : "Enter API key"
              }
            />
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={clear}
                onChange={(e) => {
                  setClear(e.target.checked);
                  if (e.target.checked) setEnabled(false);
                }}
              />
              Remove saved transcription key
            </label>
            <Button type="submit" disabled={busy}>
              Save transcription settings
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
