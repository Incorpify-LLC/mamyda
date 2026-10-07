import * as openpgp from "openpgp";

const SESSION_KEY = "mamyda.vault.priv";
let unlockedKey: openpgp.PrivateKey | null = null;

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

/** Validate a user-supplied backup without uploading it or changing stored keys. */
export async function validatePrivateKeyBackup(
  armored: string,
  passphrase: string,
  publicArmored: string,
): Promise<boolean> {
  const backupKey = await unlockPrivateKey(armored, passphrase);
  const publicKey = await openpgp.readKey({ armoredKey: publicArmored });
  return backupKey.getFingerprint() === publicKey.getFingerprint();
}

export async function encryptNote(plaintext: string, publicArmored: string): Promise<string> {
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

/** Keep decrypted private material in memory only, never Web Storage. */
export function clearUnlockedKey(): void {
  unlockedKey = null;
  try {
    sessionStorage.removeItem(SESSION_KEY); // Remove legacy persisted keys.
  } catch {
    // SSR and browsers with storage disabled have nothing to remove.
  }
}

export async function readStashedKey(): Promise<openpgp.PrivateKey | null> {
  return unlockedKey;
}

export async function stashFromDecrypted(key: openpgp.PrivateKey): Promise<void> {
  clearUnlockedKey();
  unlockedKey = key;
}
