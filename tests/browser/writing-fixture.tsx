import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EditorDraftContextProvider } from "@/components/editor-draft-context";
import { generateVaultKey } from "@/lib/vault-crypto";
import { finishEditorDraft } from "@/lib/editor-drafts";
import "@/styles.css";

function Fixture() {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  useEffect(() => {
    const existing = sessionStorage.getItem("fixture-keypair");
    if (existing) setKeys(JSON.parse(existing));
    else
      void generateVaultKey({
        name: "Test",
        email: "test@example.com",
        passphrase: "fixture-only-passphrase",
      }).then((generated) => {
        sessionStorage.setItem("fixture-keypair", JSON.stringify(generated));
        setKeys(generated);
      });
  }, []);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1>Writing fixture</h1>
      <p>{keys ? "Key ready" : "Preparing key"}</p>
      <label>
        <input
          type="checkbox"
          checked={sensitive}
          onChange={(e) => setSensitive(e.target.checked)}
        />{" "}
        Encrypt draft
      </label>
      <EditorDraftContextProvider
        value={{
          userId: "isolated-writer",
          scope: "project-p",
          publicKey: keys?.publicKey,
          privateKey: keys?.privateKey,
        }}
      >
        <label>
          Draft name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <Textarea
          draftName={name}
          aria-label="Body"
          draftId="note:new"
          markdownToolbar
          className="font-mono"
          sensitive={sensitive}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onRestoreDraft={(text, encrypted) => {
            setBody(text);
            setSensitive(encrypted);
          }}
        />
      </EditorDraftContextProvider>
      <button type="button" onClick={() => setBody("Existing saved record")}>
        Load saved record
      </button>
      <button
        type="button"
        onClick={() => {
          finishEditorDraft("note:new");
          setBody("");
        }}
      >
        Simulate successful save
      </button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
