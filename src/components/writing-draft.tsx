import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { writingDraftKey } from "@/lib/writing-draft-storage";
import { draftTitle } from "@/lib/editor-drafts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Full-record recovery for unencrypted writing editors; encrypted text uses sealed editor drafts. */
export function useWritingDraft<T>({
  kind,
  value,
  baseline,
  restore,
  persist,
  locked = false,
  ephemeral = false,
}: {
  kind: "notes" | "minutes";
  value: T;
  baseline: T;
  restore: (value: T, baseline: T) => void;
  persist: () => Promise<void>;
  locked?: boolean;
  ephemeral?: boolean;
}) {
  const user = useCurrentUser();
  const key = user ? writingDraftKey(user.id, kind) : null;
  const [recovery, setRecovery] = useState<{ value: T; baseline: T; title?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);
  const fields = value as Record<string, unknown>;
  const nonempty = [fields.body, fields.title, fields.attendees].some(
    (text) => typeof text === "string" && text.trim(),
  );
  const blocker = useBlocker({
    shouldBlockFn: () => dirty || busy.current || locked,
    withResolver: true,
    enableBeforeUnload: dirty || saving || locked,
  });
  const clear = () => {
    if (key) {
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {}
    }
  };
  useEffect(() => {
    if (!key) return;
    if (ephemeral) {
      clear();
      setRecovery(null);
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Upgrade existing note drafts without discarding their unsaved bodies.
        if (kind === "notes" && parsed.version === 1) {
          for (const part of [parsed.value, parsed.baseline]) {
            if (part && typeof part === "object" && !Object.hasOwn(part, "title")) part.title = "";
          }
        }
        // Validate against the editor's known shape before restoring untrusted storage.
        const matches = (candidate: unknown, shape: unknown): boolean => {
          if (shape === null) return candidate === null || typeof candidate === "object";
          if (typeof shape !== "object") return typeof candidate === typeof shape;
          return (
            !!candidate &&
            typeof candidate === "object" &&
            Object.entries(shape).every(([field, expected]) => {
              const actual = (candidate as Record<string, unknown>)[field];
              return expected === null
                ? actual === null || typeof actual === "string"
                : matches(actual, expected);
            })
          );
        };
        if (
          parsed.version === 1 &&
          (!parsed.updatedAt ||
            (typeof parsed.updatedAt === "number" &&
              parsed.updatedAt > Date.now() - 30 * 86400000)) &&
          [parsed.value?.body, parsed.value?.title, parsed.value?.attendees].some(
            (text) => typeof text === "string" && text.trim(),
          ) &&
          matches(parsed.value, value) &&
          matches(parsed.baseline, baseline)
        )
          setRecovery({
            ...parsed,
            title: typeof parsed.title === "string" ? parsed.title.slice(0, 80) : undefined,
          });
        else {
          sessionStorage.removeItem(key);
          localStorage.removeItem(key);
        }
      }
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
    // Read once per account/editor, never replace active typing with stored text.
  }, [key, ephemeral]);
  useEffect(() => {
    if (!key || !loaded || recovery) return;
    if (ephemeral) {
      clear();
      return;
    }
    try {
      if (dirty && nonempty)
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            value,
            baseline,
            title: draftTitle(
              String(fields.body || fields.attendees || ""),
              typeof fields.title === "string" ? fields.title : undefined,
            ),
            updatedAt: Date.now(),
          }),
        );
      else localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      setStorageError(true);
    }
  }, [key, loaded, recovery, dirty, value, baseline, ephemeral, nonempty]);
  async function save() {
    if (busy.current || locked) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await persist();
      clear();
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Your draft is still here; retry Save.",
      );
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  function request(action: () => void) {
    if (busy.current || locked) return;
    if (dirty) setPending(() => action);
    else action();
  }
  useEffect(() => {
    const intercept = (event: Event) => {
      if (dirty || busy.current || locked) {
        event.preventDefault();
        if (!busy.current && !locked) setPending(() => (event as CustomEvent<() => void>).detail);
      }
    };
    window.addEventListener("mamyda:request-sign-out", intercept);
    return () => window.removeEventListener("mamyda:request-sign-out", intercept);
  }, [dirty, locked]);
  function cancel() {
    setPending(null);
    blocker.reset?.();
  }
  function proceed() {
    const action = pending;
    setPending(null);
    if (blocker.status === "blocked") blocker.proceed();
    else action?.();
  }
  const dialog = (
    <>
      {recovery && (
        <div role="status" className="mb-4 rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm">
            An unsaved {kind === "notes" ? "note" : "minutes"} draft is available on this device.
            Drafts are removed on sign out.
            {recovery.title && <span className="mt-1 block font-medium">{recovery.title}</span>}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                restore(recovery.value, recovery.baseline);
                setRecovery(null);
              }}
            >
              Restore draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clear();
                setRecovery(null);
              }}
            >
              Discard recovered draft
            </Button>
          </div>
        </div>
      )}
      {storageError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Draft recovery storage is unavailable. Save before closing this tab.
        </p>
      )}
      {!ephemeral && loaded && dirty && nonempty && !recovery && !storageError && (
        <p role="status" className="mb-3 text-xs text-muted-foreground">
          Draft saved on this device. Use Save to publish. Drafts expire after 30 days and are
          removed on sign out.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Save failed: {error} Your draft is unchanged. Retry Save.
        </p>
      )}
      <Dialog
        open={!!pending || blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && !busy.current) cancel();
        }}
      >
        <DialogContent
          onEscapeKeyDown={(e) => {
            if (saving) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (saving) e.preventDefault();
          }}
        >
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            Save your draft before continuing, or discard these changes. Cancel keeps you here.
          </DialogDescription>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {locked && (
            <p role="status" className="mt-3 text-sm">
              Polishing your draft. Please wait before saving or discarding.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={saving || locked}
              onClick={async () => {
                if (await save()) proceed();
              }}
            >
              {saving ? "Saving…" : "Save and continue"}
            </Button>
            <Button
              disabled={saving || locked}
              variant="outline"
              onClick={() => {
                clear();
                restore(baseline, baseline);
                proceed();
              }}
            >
              Discard
            </Button>
            <Button disabled={saving} variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
  return { dirty, saving, save, request, clear, dialog, recoveryPending: !!recovery };
}
