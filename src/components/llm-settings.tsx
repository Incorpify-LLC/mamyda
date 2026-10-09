import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLLMSettings, saveLLMSettings } from "@/lib/mamyda/llm";
import { LLM_PROVIDERS, type LLMSettings } from "@/lib/llm-config";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TurnstileField } from "@/components/turnstile-field";
import { toast } from "sonner";
import { LLMEditButton } from "@/components/llm-edit-button";
import { TranscriptionSettings } from "@/components/transcription-settings";
export function LLMSettingsPanel() {
  const query = useQuery({ queryKey: ["llm-settings"], queryFn: () => getLLMSettings() });
  const [provider, setProvider] = useState<LLMSettings["provider"]>("xai"),
    [model, setModel] = useState(""),
    [enabled, setEnabled] = useState(false),
    [apiKey, setKey] = useState(""),
    [maxTokens, setMax] = useState(2048),
    [clearKey, setClear] = useState(false);
  const [captcha, setCaptcha] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data) {
      setProvider(query.data.provider);
      setModel(query.data.model);
      setEnabled(query.data.enabled);
      setMax(query.data.maxTokens);
    }
  }, [query.data]);
  if (query.isLoading) return <Card className="p-5">Loading LLM configuration…</Card>;
  if (query.isError)
    return (
      <Card className="p-5" role="alert">
        Could not load LLM settings. <Button onClick={() => void query.refetch()}>Retry</Button>
      </Card>
    );
  const sameProvider = query.data?.provider === provider;
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-display text-xl">LLM writing assistance</h2>
      <TranscriptionSettings />
      <p className="text-sm text-muted-foreground">
        Use a text/chat-capable API model for polishing and spelling correction. A chat website
        subscription or password is not an API credential. Select a model supported by your
        provider’s chat-completions API; use a fast, economical model for routine editing.
      </p>
      <p className="text-xs text-muted-foreground">
        {query.data?.source === "server"
          ? "Currently using the server’s xAI configuration. Saving creates your own preference."
          : query.data?.source === "personal"
            ? "Your personal configuration is saved."
            : "No model configured."}{" "}
        Saving does not test model access or spend API credits.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await saveLLMSettings({
              data: { provider, model, enabled, apiKey, maxTokens, clearKey },
              headers: { "x-turnstile-response": captcha },
            });
            setKey("");
            setClear(false);
            await query.refetch();
            toast.success("LLM settings saved; model access has not been tested");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save LLM settings");
          } finally {
            setBusy(false);
            setCaptcha("");
            setReset((n) => n + 1);
          }
        }}
      >
        <fieldset disabled={busy} className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable LLM writing assistance
          </label>
          <div>
            <Label htmlFor="llm-provider">API provider</Label>
            <select
              id="llm-provider"
              className="mt-1 h-10 w-full rounded-md border bg-card px-3"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as LLMSettings["provider"]);
                setKey("");
                setClear(false);
              }}
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="llm-model">API model ID</Label>
            <Input
              id="llm-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              maxLength={120}
              placeholder="Exact model ID from your provider"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use an API model ID, not a chat assistant name. Models and account access vary by
              provider.
            </p>
          </div>
          <div>
            <Label htmlFor="llm-api-key">API key</Label>
            <Input
              id="llm-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setKey(e.target.value)}
              maxLength={1000}
              placeholder={
                sameProvider && query.data?.hasKey
                  ? "Key configured — leave blank to keep it"
                  : "Enter your provider API key"
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Stored encrypted on Mamyda’s server and never returned to this form. The server can
              decrypt it to call the API; it is not protected by your Vault passphrase. Changing
              provider requires that provider’s key.
            </p>
          </div>
          {query.data?.hasKey && sameProvider && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearKey}
                onChange={(e) => {
                  setClear(e.target.checked);
                  if (e.target.checked) setEnabled(false);
                }}
              />
              Remove saved key and disable assistance when saving
            </label>
          )}
          <div>
            <Label htmlFor="llm-output">Maximum output tokens (256–4096)</Label>
            <Input
              id="llm-output"
              type="number"
              min={256}
              max={4096}
              value={maxTokens}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </div>
          <TurnstileField action="llm-settings" resetKey={reset} onToken={setCaptcha} />
          <Button type="submit" disabled={!captcha || busy}>
            {busy ? "Saving…" : "Save LLM settings"}
          </Button>
        </fieldset>
      </form>
      <LLMEditButton
        kind="spellcheck"
        label="Test saved model"
        body="Ths is a test sentence."
        disabled={busy}
        onEdited={() => {}}
        successMessage="Saved model returned a successful test response"
      />
      <p className="text-xs text-muted-foreground">
        The test uses only a built-in sample sentence, your saved configuration, and may use API
        credits. It does not test unsaved form changes.
      </p>
      <p role="note" className="text-sm text-amber-700 dark:text-amber-300">
        Using editing assistance sends the selected readable body text to the chosen provider.
        Provider privacy policies apply and API charges may apply. Mamyda asks for consent each time
        and never saves the result automatically.
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer">API model or chat model?</summary>
        <p className="mt-2 text-muted-foreground">
          Choose a chat-capable model accessed through its API. Mamyda sends a short editing
          request, not an ongoing chat history. A smaller text model is usually enough for spelling
          and grammar; use a stronger model for complex minutes. No browser login to ChatGPT or Grok
          is used.
        </p>
      </details>
    </Card>
  );
}
