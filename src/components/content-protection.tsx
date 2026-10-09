import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { unlockPrivateKey, decryptNote } from "@/lib/vault-crypto";
import { getPrivateContent } from "@/lib/mamyda/private-content";
import { RECOVERY_WARNING } from "@/lib/content-privacy";
import type { Profile } from "@/lib/mamyda/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function ContentProtection({
  profile,
  kind,
  id,
  encrypted,
  enabled,
  unlocked,
  onToggle,
  onUnlock,
  onLock,
  disabled = false,
}: {
  profile?: Profile;
  kind: "task" | "note" | "chat";
  id?: string;
  encrypted: boolean;
  enabled: boolean;
  unlocked: boolean;
  onToggle: (enabled: boolean) => void;
  onUnlock: (body: string) => void;
  onLock: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 rounded-md border p-3">
      {!encrypted && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled || !profile?.vaultPublicKey}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Encrypt content with my Vault key
        </label>
      )}
      {encrypted && (
        <p className="text-sm font-medium">
          🔒 Encrypted content · {unlocked ? "open in this editor" : "locked"}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Names, dates and tags stay visible and searchable. Content is encrypted in your browser;
        opening it requires your passphrase.
      </p>
      {!profile?.vaultPublicKey && (
        <Link to="/vault" className="text-sm underline">
          Create a Vault key and download its backup first
        </Link>
      )}
      {(enabled || encrypted) && (
        <p role="note" className="text-sm text-amber-700 dark:text-amber-300">
          {RECOVERY_WARNING}
        </p>
      )}
      {enabled && !encrypted && (
        <p className="text-xs text-muted-foreground">
          By saving encrypted, you acknowledge this recovery limitation. Existing backups or
          previously sent content are not retroactively erased.
        </p>
      )}
      {encrypted && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => {
            if (unlocked) onLock();
            else {
              setPassword("");
              setOpen(true);
            }
          }}
        >
          {unlocked ? "Lock content" : "Unlock content"}
        </Button>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer">How encryption and recovery work</summary>
        <p className="mt-2">
          Vault holds your passphrase-protected key. The server stores encrypted content, not your
          passphrase. Lock clears this editor’s readable content. Download and verify the encrypted
          key backup in Vault. Do not delete or replace that key: your encrypted items need the
          original key and passphrase.
        </p>
      </details>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            setPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Unlock {kind} content</DialogTitle>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!id || !profile?.vaultPrivateKeyArmored) return;
              setBusy(true);
              try {
                const key = await unlockPrivateKey(profile.vaultPrivateKeyArmored, password);
                const row = await getPrivateContent({ data: { kind, id } });
                if (key.getFingerprint() !== row.fingerprint)
                  throw new Error("This item needs a different Vault key");
                onUnlock(await decryptNote(row.ciphertext, key));
                setOpen(false);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not decrypt; check your passphrase",
                );
              } finally {
                setBusy(false);
                setPassword("");
              }
            }}
          >
            <Label htmlFor="private-content-password">Vault passphrase</Label>
            <Input
              id="private-content-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={!password || busy}>
              {busy ? "Decrypting…" : "Unlock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
