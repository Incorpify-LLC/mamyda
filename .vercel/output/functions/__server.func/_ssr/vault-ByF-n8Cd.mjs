import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as useCurrentUser } from "./use-current-user-D8_Gc8Fk.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Card, t as Button } from "./calendar-B9Go77HQ.mjs";
import { E as useWorkspace, T as useVaultList, g as saveVaultNote, h as saveVaultKeys, l as deleteVaultNote, t as AppShell, u as getVaultCipher } from "./hooks-BiFypmM2.mjs";
import { n as Label, t as Input } from "./label-YCOp9q5W.mjs";
import { t as Textarea } from "./textarea-DUJYKurs.mjs";
import { a as generateKey, c as readPrivateKey, i as encrypt, n as decrypt, o as readKey, r as decryptKey, s as readMessage, t as createMessage } from "../_libs/openpgp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vault-ByF-n8Cd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SESSION_KEY = "mamyda.vault.priv";
async function generateVaultKey(opts) {
	const { privateKey, publicKey } = await generateKey({
		type: "curve25519",
		userIDs: [{
			name: opts.name,
			email: opts.email
		}],
		passphrase: opts.passphrase,
		format: "armored"
	});
	return {
		publicKey,
		privateKey
	};
}
async function unlockPrivateKey(armored, passphrase) {
	const key = await readPrivateKey({ armoredKey: armored });
	return decryptKey({
		privateKey: key,
		passphrase
	});
}
async function encryptNote(plaintext, publicArmored) {
	const publicKey = await readKey({ armoredKey: publicArmored });
	const message = await createMessage({ text: plaintext });
	return encrypt({
		message,
		encryptionKeys: publicKey,
		format: "armored"
	});
}
async function decryptNote(ciphertext, privateKey) {
	const message = await readMessage({ armoredMessage: ciphertext });
	return (await decrypt({
		message,
		decryptionKeys: privateKey
	})).data.toString();
}
function stashUnlockedKey(armoredDecrypted) {
	try {
		sessionStorage.setItem(SESSION_KEY, armoredDecrypted);
	} catch {}
}
function clearUnlockedKey() {
	try {
		sessionStorage.removeItem(SESSION_KEY);
	} catch {}
}
async function readStashedKey() {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		return readPrivateKey({ armoredKey: raw });
	} catch {
		return null;
	}
}
async function stashFromDecrypted(key) {
	stashUnlockedKey(key.armor());
}
function VaultPage() {
	const user = useCurrentUser();
	const ws = useWorkspace();
	const list = useVaultList();
	const [key, setKey] = (0, import_react.useState)(null);
	const [passphrase, setPassphrase] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [title, setTitle] = (0, import_react.useState)("");
	const [body, setBody] = (0, import_react.useState)("");
	const [editingId, setEditingId] = (0, import_react.useState)(null);
	const profile = ws.data?.profile;
	const hasKeys = Boolean(profile?.vaultPublicKey && profile?.vaultPrivateKeyArmored);
	(0, import_react.useEffect)(() => {
		readStashedKey().then((k) => {
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
				passphrase
			});
			await saveVaultKeys({ data: {
				publicKey: pair.publicKey,
				privateKeyArmored: pair.privateKey
			} });
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
			const unlocked = await unlockPrivateKey(profile.vaultPrivateKeyArmored, passphrase);
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
			await saveVaultNote({ data: {
				id: editingId ?? void 0,
				title: title || "Untitled",
				ciphertext
			} });
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
	async function openNote(id, noteTitle) {
		if (!key) return;
		try {
			const plain = await decryptNote((await getVaultCipher({ data: id })).ciphertext, key);
			setEditingId(id);
			setTitle(noteTitle);
			setBody(plain);
		} catch {
			toast.error("Could not decrypt");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Vault",
		action: key ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "outline",
			size: "sm",
			onClick: () => {
				clearUnlockedKey();
				setKey(null);
			},
			children: "Lock"
		}) : null,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-6 max-w-xl text-sm text-muted-foreground",
				children: [
					"Notes are encrypted in this browser with OpenPGP. The server keeps only ciphertext and a passphrase-protected private key. Desktop",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "text-xs",
						children: "gpg"
					}),
					" can read anything you export."
				]
			}),
			!hasKeys && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "max-w-md p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Create your key"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "This passphrase wraps the private key. It is never sent in the clear."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "vp",
							children: "Passphrase"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "vp",
							type: "password",
							value: passphrase,
							onChange: (e) => setPassphrase(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-4",
						disabled: busy,
						onClick: () => void createKeys(),
						children: busy ? "Creating…" : "Generate key"
					})
				]
			}),
			hasKeys && !key && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "max-w-md p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl",
						children: "Unlock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "up",
							children: "Passphrase"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "up",
							type: "password",
							value: passphrase,
							onChange: (e) => setPassphrase(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") unlock();
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-4",
						disabled: busy,
						onClick: () => void unlock(),
						children: "Unlock"
					})
				]
			}),
			key && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-[18rem_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [(list.data ?? []).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "w-full rounded-lg border border-border bg-card px-3 py-2 text-left",
						onClick: () => void openNote(n.id, n.title),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: n.title
						})
					}, n.id)), (list.data ?? []).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Vault is empty."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "p-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Title",
								value: title,
								onChange: (e) => setTitle(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								className: "min-h-56",
								placeholder: "This never leaves the browser in plaintext.",
								value: body,
								onChange: (e) => setBody(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										disabled: busy || !body.trim(),
										onClick: () => void save(),
										children: "Encrypt & save"
									}),
									editingId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: async () => {
											await deleteVaultNote({ data: editingId });
											setEditingId(null);
											setTitle("");
											setBody("");
											await list.refetch();
										},
										children: "Delete"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										onClick: () => {
											setEditingId(null);
											setTitle("");
											setBody("");
										},
										children: "New"
									})
								]
							})
						]
					})
				})]
			})
		]
	});
}
//#endregion
export { VaultPage as component };
