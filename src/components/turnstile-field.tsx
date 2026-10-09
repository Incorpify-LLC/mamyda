import { useCallback, useEffect, useRef, useState } from "react";
import { turnstileSiteKey } from "@/lib/auth/public-config";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

export type TurnstileStatus =
  "loading" | "ready" | "verified" | "expired" | "error" | "unavailable";

function api(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

export function TurnstileField({
  action,
  resetKey,
  onToken,
  onStatus,
  size = "normal",
  refreshExpired = "auto",
  appearance = "always",
}: {
  action: string;
  resetKey: number;
  onToken: (token: string) => void;
  onStatus?: (status: TurnstileStatus) => void;
  size?: "normal" | "compact" | "flexible";
  refreshExpired?: "auto" | "manual";
  appearance?: "always" | "execute" | "interaction-only";
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");
  const [siteKey, setSiteKey] = useState("");
  const [status, setStatus] = useState<TurnstileStatus>("loading");
  const [retryCount, setRetryCount] = useState(0);

  const updateStatus = useCallback(
    (next: TurnstileStatus) => {
      setStatus(next);
      onStatus?.(next);
    },
    [onStatus],
  );

  useEffect(() => {
    let active = true;
    void turnstileSiteKey()
      .then((key) => {
        if (!active) return;
        setSiteKey(key);
        if (!key) updateStatus("unavailable");
      })
      .catch(() => {
        if (active) updateStatus("error");
      });
    return () => {
      active = false;
    };
  }, [updateStatus, retryCount]);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let active = true;
    const render = () => {
      if (!active) return;
      const turnstile = api();
      if (!turnstile || !holder.current) {
        updateStatus("error");
        return;
      }
      holder.current.replaceChildren();
      try {
        updateStatus("ready");
        widgetId.current = turnstile.render(holder.current, {
          sitekey: siteKey,
          action,
          size,
          appearance,
          "refresh-expired": refreshExpired,
          callback: (token: string) => {
            if (!active) return;
            onToken(token);
            updateStatus("verified");
          },
          "error-callback": () => {
            if (!active) return;
            onToken("");
            updateStatus("error");
          },
          "expired-callback": () => {
            if (!active) return;
            onToken("");
            updateStatus("expired");
          },
          "timeout-callback": () => {
            if (!active) return;
            onToken("");
            updateStatus("expired");
          },
          "unsupported-callback": loadError,
        });
      } catch {
        updateStatus("error");
      }
    };
    const loadError = () => {
      if (!active) return;
      onToken("");
      updateStatus("error");
    };
    let existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing?.dataset.failed === "1") {
      existing.remove();
      existing = null;
    }
    if (api()) render();
    else {
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = "1";
        script.onerror = () => {
          script.dataset.failed = "1";
        };
        existing = script;
      }
      existing.addEventListener("load", render, { once: true });
      existing.addEventListener("error", loadError, { once: true });
      if (!existing.isConnected) document.head.appendChild(existing);
    }
    return () => {
      active = false;
      existing?.removeEventListener("load", render);
      existing?.removeEventListener("error", loadError);
      const turnstile = api();
      if (widgetId.current && turnstile) turnstile.remove(widgetId.current);
      widgetId.current = "";
    };
  }, [
    action,
    onToken,
    resetKey,
    retryCount,
    siteKey,
    updateStatus,
    size,
    refreshExpired,
    appearance,
  ]);

  return (
    <div className="space-y-1" data-action="turnstile-spin-v2">
      {siteKey && <div ref={holder} className={appearance === "always" ? "min-h-16" : undefined} />}
      <div
        className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {status === "loading" && "Loading security check…"}
        {status === "ready" && "Complete the security check to continue."}
        {status === "verified" && "Security check complete."}
        {status === "expired" && "Security check expired. Complete it again to continue."}
        {status === "error" && "Security check failed to load. Retry the check."}
        {status === "unavailable" &&
          "Security check is not configured. Contact your administrator."}
        {(status === "expired" || status === "error") && (
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={() => {
              onToken("");
              updateStatus("loading");
              setRetryCount((count) => count + 1);
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
