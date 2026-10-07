import { useEffect, useRef, useState } from "react";
import { turnstileSiteKey } from "@/lib/auth/public-config";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

function api(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

export function TurnstileField({
  action,
  resetKey,
  onToken,
}: {
  action: string;
  resetKey: number;
  onToken: (token: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [siteKey, setSiteKey] = useState("");

  useEffect(() => {
    void turnstileSiteKey().then(setSiteKey).catch(() => setSiteKey(""));
  }, []);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let widgetId = "";
    const render = () => {
      const turnstile = api();
      if (!turnstile || !holder.current) return;
      holder.current.replaceChildren();
      widgetId = turnstile.render(holder.current, {
        sitekey: siteKey,
        action,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing && api()) render();
    else if (!existing) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "1";
      script.onload = render;
      document.head.appendChild(script);
    } else {
      existing.addEventListener("load", render, { once: true });
    }
    return () => {
      const turnstile = api();
      if (widgetId && turnstile) turnstile.remove(widgetId);
    };
  }, [action, onToken, resetKey, siteKey]);

  if (!siteKey) return null;
  return <div ref={holder} className="min-h-16" data-action="turnstile-spin-v2" />;
}
