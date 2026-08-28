import * as openpgp from "openpgp";

const SESSION_KEY = "mamyda.vault.priv";

export async function generateVaultKey(opts: {
  name: string;
  email: string;
  passphrase: string;
}): Promise<{ publicKey: string; privateKey: string }> {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: opts.name, email: opts.email }],
    passphrase: opts.passphrase,
    format: "armored",
  });
  return { publicKey, privateKey };
}

export async function unlockPrivateKey(
  armored: string,
  passphrase: string,
): Promise<openpgp.PrivateKey> {
  const key = await openpgp.readPrivateKey({ armoredKey: armored });
  return openpgp.decryptKey({ privateKey: key, passphrase });
}

export async function encryptNote(
  plaintext: string,
  publicArmored: string,
): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: publicArmored });
  const message = await openpgp.createMessage({ text: plaintext });
  return openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
    format: "armored",
  });
}

export async function decryptNote(
  ciphertext: string,
  privateKey: openpgp.PrivateKey,
): Promise<string> {
  const message = await openpgp.readMessage({ armoredMessage: ciphertext });
  const result = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
  });
  return result.data.toString();
}

export function stashUnlockedKey(armoredDecrypted: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, armoredDecrypted);
  } catch {
    /* ignore */
  }
}

export function clearUnlockedKey(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function readStashedKey(): Promise<openpgp.PrivateKey | null> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return openpgp.readPrivateKey({ armoredKey: raw });
  } catch {
    return null;
  }
}

export async function stashFromDecrypted(
  key: openpgp.PrivateKey,
): Promise<void> {
  stashUnlockedKey(key.armor());
}
