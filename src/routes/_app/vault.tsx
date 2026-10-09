import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PrivateKey } from "openpgp";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  unlockPrivateKey,
  validatePrivateKeyBackup,
} from "@/lib/vault-crypto";
import { toast } from "sonner";
import { boardSearchContext } from "@/lib/board-navigation";

export const Route = createFileRoute("/_app/vault")({
  validateSearch: boardSearchContext,
  component: VaultPage,
});

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
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [checkingBackup, setCheckingBackup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState<{ id: string; title: string } | null>(null);
  const [assetPassword, setAssetPassword] = useState("");

  const profile = ws.data?.profile;
  const hasKeys = Boolean(profile?.vaultPublicKey && profile?.vaultPrivateKeyArmored);

  function downloadText(filename: string, contents: string, type: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportKeyBackup() {
    if (!key || !profile?.vaultPrivateKeyArmored) return;
    if (
      !window.confirm(
        "Download your encrypted private key backup? Keep this file private and remember the vault passphrase; without both, the vault cannot be recovered.",
      )
    )
      return;
    downloadText(
      "mamyda-vault-private-key.asc",
      profile.vaultPrivateKeyArmored,
      "application/pgp-keys",
    );
    toast.success("Encrypted key backup downloaded");
  }

  function exportCurrentNote() {
    if (!key || !body.trim()) return;
    if (
      !window.confirm(
        "This creates a plaintext JSON file on your device. Anyone who gets the file can read it.",
      )
    )
      return;
    downloadText(
      "mamyda-vault-note.json",
      JSON.stringify(
        {
          format: "mamyda-vault-note-v1",
          exportedAt: new Date().toISOString(),
          title: title || "Untitled",
          body,
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  async function exportAllNotes() {
    if (!key || !list.data?.length || exporting) return;
    if (
      !window.confirm(
        "This decrypts all saved vault notes in this browser and downloads them as plaintext JSON. Anyone who gets the file can read every note.",
      )
    )
      return;
    setExporting(true);
    try {
      const notes = [];
      for (const item of list.data) {
        const row = await getVaultCipher({ data: item.id });
        notes.push({
          id: item.id,
          title: item.title,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          body: await decryptNote(row.ciphertext, key),
        });
      }
      downloadText(
        "mamyda-vault-notes.json",
        JSON.stringify(
          { format: "mamyda-vault-export-v1", exportedAt: new Date().toISOString(), notes },
          null,
          2,
        ),
        "application/json",
      );
      toast.success(
        `${notes.length} saved note${notes.length === 1 ? "" : "s"} exported to this device`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not export notes; no file was created.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function verifyBackup() {
    if (!backupFile || !backupPassphrase || !profile?.vaultPublicKey) return;
    setCheckingBackup(true);
    try {
      if (backupFile.size > 50_000)
        throw new Error("Choose a private-key backup smaller than 50 KB.");
      const matches = await validatePrivateKeyBackup(
        await backupFile.text(),
        backupPassphrase,
        profile.vaultPublicKey,
      );
      if (!matches) throw new Error("That key belongs to a different vault.");
      toast.success("Backup verified — it unlocks this vault's key.");
      setBackupFile(null);
      setBackupPassphrase("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Backup could not be verified. Check the file and passphrase.",
      );
    } finally {
      setCheckingBackup(false);
    }
  }

  useEffect(() => {
    clearUnlockedKey();
    return () => clearUnlockedKey();
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
      const unlocked = await unlockPrivateKey(profile.vaultPrivateKeyArmored, passphrase);
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
    setAssetPassword("");
    setOpening({ id, title: noteTitle });
  }

  async function decryptSelected() {
    if (!opening || !profile?.vaultPrivateKeyArmored) return;
    setBusy(true);
    try {
      const explicitKey = await unlockPrivateKey(profile.vaultPrivateKeyArmored, assetPassword);
      const row = await getVaultCipher({ data: opening.id });
      const plain = await decryptNote(row.ciphertext, explicitKey);
      setEditingId(opening.id);
      setTitle(opening.title);
      setBody(plain);
      setOpening(null);
    } catch {
      toast.error("Could not decrypt. Check this asset's key and password.");
    } finally {
      setBusy(false);
      setAssetPassword("");
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
              setBody("");
              setTitle("");
              setEditingId(null);
            }}
          >
            Lock
          </Button>
        ) : null
      }
    >
      <Dialog
        open={Boolean(opening)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setOpening(null);
            setAssetPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Unlock {opening?.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter your workspace Vault password to decrypt this note in this browser.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void decryptSelected();
            }}
          >
            <Label htmlFor="asset-password">Vault password</Label>
            <Input
              id="asset-password"
              type="password"
              autoComplete="off"
              value={assetPassword}
              onChange={(e) => setAssetPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy || !assetPassword}>
              {busy ? "Decrypting…" : "Unlock note"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Card className="mb-4 p-4">
        <h2 className="font-medium">Project association and encryption are separate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Current Vault notes use your workspace key. Tasks and Notes can optionally encrypt their
          content with this same key. Files and Minutes are not Vault-encrypted yet. The planned
          model lets each project reuse a workspace key or choose its own key; encryption is
          optional. Project-specific keys are not available yet. Opening Vault always requires your
          passphrase; it does not restore an unlocked key automatically.
        </p>
      </Card>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Notes are encrypted in this browser with OpenPGP. The server keeps only ciphertext and a
        passphrase-protected private key. Desktop <code className="text-xs">gpg</code> can read
        anything you export.
      </p>

      {hasKeys && (
        <Card className="mb-4 max-w-2xl border-amber-500/40 p-4">
          <h2 className="font-medium">Protect your recovery path</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mamyda cannot reset a forgotten vault passphrase. Keep your passphrase and a backup of
            the encrypted private key in separate safe places; without both, encrypted notes cannot
            be recovered.
          </p>
        </Card>
      )}

      {!hasKeys && (
        <Card className="max-w-md p-5">
          <h2 className="font-display text-xl">Create your key</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This passphrase wraps the private key. It is never sent in the clear. Mamyda cannot
            reset it. After creating your vault, download and verify the encrypted key backup.
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
        <>
          <Card className="mb-4 space-y-4 p-4">
            <div>
              <h2 className="font-medium">Back up and export</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Key backup stays passphrase-protected. Note exports are plaintext files created only
                on this device; Mamyda never receives the exports.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportKeyBackup}>
                Download encrypted key backup (.asc)
              </Button>
              <Button
                variant="outline"
                disabled={!list.data?.length || exporting}
                onClick={() => void exportAllNotes()}
              >
                {exporting ? "Exporting…" : "Export all saved notes (.json)"}
              </Button>
              <Button variant="outline" disabled={!body.trim()} onClick={exportCurrentNote}>
                Export this note (.json)
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="vault-backup-file">Verify an encrypted key backup</Label>
                <Input
                  id="vault-backup-file"
                  type="file"
                  accept=".asc,.txt,application/pgp-keys"
                  onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vault-backup-passphrase">Backup passphrase</Label>
                <Input
                  id="vault-backup-passphrase"
                  type="password"
                  autoComplete="off"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={!backupFile || !backupPassphrase || checkingBackup}
                onClick={() => void verifyBackup()}
              >
                {checkingBackup ? "Checking…" : "Verify backup"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Verification happens in your browser. It checks the selected file against this vault’s
              public key and never uploads the file or passphrase.
            </p>
          </Card>
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
        </>
      )}
    </AppShell>
  );
}
