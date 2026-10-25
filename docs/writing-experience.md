# Writing and workspace memory

## Markdown

Long-form fields (task content, note content, minutes, project/event descriptions,
Vault notes and chat questions) share **Edit / Preview** controls. Preview supports
headings, lists, links, fenced code, tables and checklists. Switching views preserves
the exact source. Chat messages render Markdown too. Names, email addresses, tags,
passwords, URLs and other structured inputs remain plain text.

Raw HTML is never executed. Remote images are shown as alt-text placeholders rather
than fetched, and unsafe link schemes are stripped. Very large previews are capped
at 100,000 characters; editing and storage do not truncate the original source.

## Draft recovery

Drafts are local to this browser and account, not synced to other devices. Saving a
record or sending a question remains explicit and uses the existing verification
flow; autosaving drafts does not contact the server or start a CAPTCHA.

Unencrypted Notes and Minutes retain their full editor state, including title and
project linkage. Other long-form fields retain their text per record/project.
Untitled ordinary drafts use the opening sentence as a recovery label. Empty text
does not create a draft. Changing a name after writing updates the recovery label
without re-encrypting the body. The server also rejects completely blank Notes and
Minutes, while accepting untitled entries with content. Existing recovery is presented explicitly instead of
silently overwriting either the saved record or the draft. Restoring or discarding
the draft enables editing again. Successful saves remove the corresponding draft.

Encrypted note/task/Vault drafts are sealed with the account's Vault public key.
Their recovery labels never derive from private content. Restoration requires the
original Vault key and passphrase; neither an unlocked private key nor a passphrase
is placed in browser storage. Forgetting the passphrase or losing the key can make
the content permanently unrecoverable. A storage/encryption error is shown instead
of falling back to plaintext. Wait for the saved confirmation before closing.

Draft recovery is available for 30 days; expired/invalid entries are removed when
their editor is opened. Signing out removes drafts. Browser data clearing also
removes them. These are recovery aids, not backups or a cross-device drafts library.

## Remembered workspace

Only navigation metadata (client ID, project ID and Board section) is stored per
account. Reloads and Board navigation reuse it; revisiting the app's root resumes
the last Board section when available. Explicit links take precedence. Selecting
All projects remains explicit. Missing/archived contexts require a new selection
instead of silently switching to an unrelated project.

## Verification

Run `npm run typecheck` and `npm test`. Start the isolated fixtures with
`node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts`, then run
`node scripts/writing-ui-e2e.mjs` and `node scripts/context-ui-e2e.mjs`.
The fixtures use disposable keys/data and never call paid models or live accounts.
