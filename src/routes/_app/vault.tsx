import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PrivateKey } from "openpgp";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useVaultList, useWorkspace } from "@/lib/mamyda/hooks";
import {
  deleteVaultNote,
  getVaultCipher,
  saveVaultKeys,
  saveVaultNote,
} from "@/lib/mamyda/writing";
import {
  clearUnlockedKey,
  decryptNote,
  encryptNote,
  generateVaultKey,
  readStashedKey,
  stashFromDecrypted,
  unlockPrivateKey,
} from "@/lib/vault-crypto";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vault")({ component: VaultPage });

function VaultPage() {
  const user = useCurrentUser();
  const ws = useWorkspace();
  const list = useVaultList();
  const [key, setKey] = useState<PrivateKey | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const profile = ws.data?.profile;
  const hasKeys = Boolean(profile?.vaultPublicKey && profile?.vaultPrivateKeyArmored);

  useEffect(() => {
    void readStashedKey().then((k) => {
      if (k) setKey(k);
    });
  }, []);

  async function createKeys() {
    if (passphrase.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const pair = await generateVaultKey({
        name: user?.displayName || "Mamyda",
        email: user?.primaryEmail || "vault@mamyda.local",
        passphrase,
      });
      await saveVaultKeys({
        data: { publicKey: pair.publicKey, privateKeyArmored: pair.privateKey },
      });
      const unlocked = await unlockPrivateKey(pair.privateKey, passphrase);
      await stashFromDecrypted(unlocked);
      setKey(unlocked);
      setPassphrase("");
      await ws.refetch();
      toast.success("Vault key created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!profile?.vaultPrivateKeyArmored) return;
    setBusy(true);
    try {
      const unlocked = await unlockPrivateKey(
        profile.vaultPrivateKeyArmored,
        passphrase,
      );
      await stashFromDecrypted(unlocked);
      setKey(unlocked);
      setPassphrase("");
    } catch {
      toast.error("Wrong passphrase");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!key || !profile?.vaultPublicKey) return;
    setBusy(true);
    try {
      const ciphertext = await encryptNote(body, profile.vaultPublicKey);
      await saveVaultNote({
        data: {
          id: editingId ?? undefined,
          title: title || "Untitled",
          ciphertext,
        },
      });
      setTitle("");
      setBody("");
      setEditingId(null);
      await list.refetch();
      toast.success("Locked and stored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Encrypt failed");
    } finally {
      setBusy(false);
    }
  }

  async function openNote(id: string, noteTitle: string) {
    if (!key) return;
    try {
      const row = await getVaultCipher({ data: id });
      const plain = await decryptNote(row.ciphertext, key);
      setEditingId(id);
      setTitle(noteTitle);
      setBody(plain);
    } catch {
      toast.error("Could not decrypt");
    }
  }

  return (
    <AppShell
      title="Vault"
      action={
        key ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearUnlockedKey();
              setKey(null);
            }}
          >
            Lock
          </Button>
        ) : null
      }
    >
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Notes are encrypted in this browser with OpenPGP. The server keeps only
        ciphertext and a passphrase-protected private key. Desktop{" "}
        <code className="text-xs">gpg</code> can read anything you export.
      </p>

      {!hasKeys && (
        <Card className="max-w-md p-5">
          <h2 className="font-display text-xl">Create your key</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This passphrase wraps the private key. It is never sent in the
            clear.
          </p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="vp">Passphrase</Label>
            <Input
              id="vp"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
          <Button className="mt-4" disabled={busy} onClick={() => void createKeys()}>
            {busy ? "Creating…" : "Generate key"}
          </Button>
        </Card>
      )}

      {hasKeys && !key && (
        <Card className="max-w-md p-5">
          <h2 className="font-display text-xl">Unlock</h2>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="up">Passphrase</Label>
            <Input
              id="up"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
            />
          </div>
          <Button className="mt-4" disabled={busy} onClick={() => void unlock()}>
            Unlock
          </Button>
        </Card>
      )}

      {key && (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="space-y-2">
            {(list.data ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left"
                onClick={() => void openNote(n.id, n.title)}
              >
                <p className="text-sm font-medium">{n.title}</p>
              </button>
            ))}
            {(list.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Vault is empty.</p>
            )}
          </div>
          <Card className="p-5">
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                className="min-h-56"
                placeholder="This never leaves the browser in plaintext."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex gap-2">
                <Button disabled={busy || !body.trim()} onClick={() => void save()}>
                  Encrypt & save
                </Button>
                {editingId && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await deleteVaultNote({ data: editingId });
                      setEditingId(null);
                      setTitle("");
                      setBody("");
                      await list.refetch();
                    }}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setTitle("");
                    setBody("");
                  }}
                >
                  New
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
