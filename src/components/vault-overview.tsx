import { Card } from "@/components/ui/card";
import { RECOVERY_WARNING } from "@/lib/content-privacy";

export function VaultOverview() {
  return (
    <div className="mb-4 space-y-3">
      <Card className="border-amber-500/40 p-4">
        <h2 className="font-medium">Keep your passphrase and key backup safe</h2>
        <p role="note" className="mt-1 text-sm text-amber-800 dark:text-amber-200">
          {RECOVERY_WARNING} Without them, access can be permanently lost.
        </p>
      </Card>
      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">What Vault protects today</summary>
        <ul className="mt-3 space-y-2 pl-5 text-sm list-disc">
          <li>
            Vault notes: encrypted content, opened only with your passphrase. Titles remain visible.
          </li>
          <li>
            Tasks and Notes: optional content encryption with your workspace Vault key. Names, dates
            and tags remain visible and searchable.
          </li>
          <li>
            Files and Minutes: not Vault-encrypted. New LLM chats are not encrypted; earlier
            encrypted chats still require their original passphrase.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Keys and legacy Vault notes are workspace-wide. The Board selector only carries project
          context to other sections; it does not filter these notes or create project-specific keys.
          Lock clears readable editor content. Returning here never unlocks automatically.
        </p>
      </details>
    </div>
  );
}
