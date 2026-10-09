import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLLMSettings, editWithLLM } from "@/lib/mamyda/llm";
import { LLM_PROVIDERS } from "@/lib/llm-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TurnstileField } from "@/components/turnstile-field";
import { toast } from "sonner";
export function LLMEditButton({
  body,
  title = "",
  attendees = "",
  kind = "polish",
  label = "Polish with LLM",
  disabled = false,
  onEdited,
  onBusyChange,
  successMessage = "Edited — review the draft, then save",
}: {
  body: string;
  title?: string;
  attendees?: string;
  kind?: "minutes-polish" | "polish" | "spellcheck";
  label?: string;
  disabled?: boolean;
  onEdited: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["llm-settings"],
    queryFn: () => getLLMSettings(),
    enabled: open,
    staleTime: 0,
  });
  useEffect(() => {
    if (!open) {
      setConsent(false);
      setToken("");
      setReset((n) => n + 1);
    }
  }, [open]);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || busy || !body.trim()}
        onClick={() => setOpen(true)}
      >
        {busy ? "Editing…" : label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle>{label}</DialogTitle>
          {query.isLoading && <p>Loading selected model…</p>}
          {query.isError && (
            <p role="alert">
              Could not load LLM configuration.{" "}
              <Button onClick={() => void query.refetch()}>Retry</Button>
            </p>
          )}
          {query.data && (
            <>
              <p className="break-all text-sm">
                Provider: {LLM_PROVIDERS.find((p) => p.id === query.data.provider)?.label}. Model:{" "}
                {query.data.model || "Not configured"}.
              </p>
              {!query.data.enabled || !query.data.hasKey ? (
                <p>
                  Writing assistance is unavailable.{" "}
                  <Link to="/settings" search={{ section: "llm" }} className="underline">
                    Configure Settings → LLM
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    This sends the current readable body text to the selected external provider.
                    Content is sent readable, not Vault-encrypted. Provider policies and API charges
                    apply. Review the result before saving; names and facts can be changed
                    incorrectly.
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I agree to send this content to the displayed provider for this edit.
                  </label>
                  <TurnstileField action="llm-edit" resetKey={reset} onToken={setToken} />
                  <Button
                    type="button"
                    disabled={!consent || !token || busy}
                    onClick={async () => {
                      setBusy(true);
                      onBusyChange?.(true);
                      try {
                        const result = await editWithLLM({
                          data: {
                            kind,
                            body,
                            title,
                            attendees,
                            consent: true,
                            selection: { provider: query.data.provider, model: query.data.model },
                          },
                          headers: { "x-turnstile-response": token },
                        });
                        onEdited(result.text);
                        toast.success(successMessage);
                        setOpen(false);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not edit; your draft is unchanged",
                        );
                      } finally {
                        setBusy(false);
                        onBusyChange?.(false);
                        setToken("");
                        setReset((n) => n + 1);
                      }
                    }}
                  >
                    {busy ? "Editing…" : "Send for editing"}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
