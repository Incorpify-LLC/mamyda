import { randomBytes } from "node:crypto";
import { z } from "zod";
import { readKey } from "openpgp";
import type { Sql } from "@/lib/db";
import { ASSET_ENCRYPTION_FORMAT, MAX_ASSET_BYTES } from "@/lib/vault-assets";
import {
  MAX_CIPHER_BYTES,
  assetObjectKey,
  readBoundedCipher,
  verifyStoredCipher,
} from "./vault-storage.server";

export interface VaultStore {
  bucket: string;
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<AsyncIterable<Uint8Array>>;
  remove(key: string): Promise<void>;
}

const id = z.string().regex(/^[a-f0-9]{32}$/);
const association = z.string().min(1).max(200).nullable().optional();
export const assetReservationInput = z
  .object({
    assetId: id.optional(),
    baseRevision: z.number().int().min(0).default(0),
    kind: z.enum(["file", "note", "minutes", "vault"]),
    title: z.string().trim().min(1).max(200),
    originalSize: z.number().int().min(1).max(MAX_ASSET_BYTES),
    cipherSize: z.number().int().min(1).max(MAX_CIPHER_BYTES),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    contentType: z
      .string()
      .regex(/^[\w.+-]+\/[\w.+-]+$/)
      .max(150),
    keyFingerprint: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
    clientId: association,
    projectId: association,
    eventId: association,
  })
  .strict();

type Upload = {
  id: string;
  asset_id: string;
  user_id: string;
  base_revision: number;
  state: string;
  object_key: string;
  bucket: string;
  cipher_size: number;
  digest: string;
  expires_at: string | Date;
  current_revision: number;
  deleted_at: string | null;
};
const freshId = () => randomBytes(16).toString("hex");

/** Request adapters supply a verified owner, configured store and server-side CAPTCHA gate. */
export function createVaultWorkflow(
  sql: Sql,
  store: VaultStore,
  guard: (action: string) => Promise<void>,
) {
  if (store.bucket !== "mamyda") throw new Error("Unexpected Vault bucket");
  async function ownedUpload(owner: string, uploadId: string) {
    id.parse(uploadId);
    const rows = await sql<Upload>`select u.*, a.current_revision, a.deleted_at
      from vault_asset_uploads u join vault_assets a on a.id=u.asset_id and a.user_id=u.user_id
      where u.id=${uploadId} and u.user_id=${owner}`;
    if (!rows[0] || rows[0].deleted_at) throw new Error("Asset not found");
    return rows[0];
  }
  function unexpired(row: Upload) {
    if (new Date(row.expires_at).getTime() <= Date.now())
      throw new Error("Upload reservation expired");
  }
  async function current(owner: string, assetId: string) {
    id.parse(assetId);
    const rows = await sql<Upload>`select u.*, a.current_revision, a.deleted_at
      from vault_assets a join vault_asset_uploads u on u.asset_id=a.id and u.user_id=a.user_id
      and u.base_revision=a.current_revision-1 and u.state='ready'
      where a.id=${assetId} and a.user_id=${owner} and a.deleted_at is null`;
    if (!rows[0]) throw new Error("Asset not found");
    return rows[0];
  }
  return {
    async reserve(owner: string, raw: unknown) {
      await guard("vault-asset-write");
      const data = assetReservationInput.parse(raw);
      const profile = await sql<{
        vault_public_key: string;
      }>`select vault_public_key from profiles where user_id=${owner}`;
      if (!profile[0]?.vault_public_key) throw new Error("Create a Vault key first");
      const publicKey = await readKey({ armoredKey: profile[0].vault_public_key });
      if (publicKey.getFingerprint() !== data.keyFingerprint)
        throw new Error("Vault key changed; reload before encrypting");
      let clientId = data.clientId ?? null;
      if (data.projectId) {
        const project = await sql<{
          client_id: string;
        }>`select client_id from projects where id=${data.projectId} and user_id=${owner}`;
        if (!project[0] || (clientId && clientId !== project[0].client_id))
          throw new Error("Project not found for this client");
        clientId = project[0].client_id;
      }
      if (
        clientId &&
        !(await sql`select id from clients where id=${clientId} and user_id=${owner}`)[0]
      )
        throw new Error("Client not found");
      if (
        data.eventId &&
        !(
          await sql`select id from calendar_events where id=${data.eventId} and user_id=${owner}`
        )[0]
      )
        throw new Error("Event not found");
      const assetId = data.assetId ?? freshId();
      if (data.assetId) {
        const asset = await sql<{
          current_revision: number;
          kind: string;
        }>`select current_revision,kind from vault_assets where id=${assetId} and user_id=${owner} and deleted_at is null`;
        if (
          !asset[0] ||
          asset[0].current_revision !== data.baseRevision ||
          asset[0].kind !== data.kind
        )
          throw new Error("Asset revision changed; reload before saving");
      } else if (data.baseRevision !== 0) throw new Error("Invalid initial revision");
      const uploadId = freshId();
      const key = assetObjectKey(owner, assetId, uploadId);
      await sql`update vault_asset_uploads set state='retired' where asset_id=${assetId}
        and user_id=${owner} and state in ('pending','uploading','uploaded') and expires_at<now()`;
      // One atomic statement creates the asset and reservation together.
      await sql.query(
        `WITH asset AS (
        INSERT INTO vault_assets(id,user_id,kind) VALUES($1,$2,$3)
        ON CONFLICT(id) DO NOTHING RETURNING id
      ) INSERT INTO vault_asset_uploads(id,asset_id,user_id,base_revision,bucket,object_key,
        encryption_format,key_fingerprint,original_size,cipher_size,digest,title,content_type,
        client_id,project_id,event_id,expires_at)
        VALUES($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now()+interval '15 minutes')`,
        [
          assetId,
          owner,
          data.kind,
          uploadId,
          data.baseRevision,
          store.bucket,
          key,
          ASSET_ENCRYPTION_FORMAT,
          data.keyFingerprint,
          data.originalSize,
          data.cipherSize,
          data.digest,
          data.title,
          data.contentType,
          clientId,
          data.projectId ?? null,
          data.eventId ?? null,
        ],
      );
      return { assetId, uploadId, uploadUrl: `/api/vault/uploads/${uploadId}` };
    },
    async upload(owner: string, uploadId: string, body: AsyncIterable<Uint8Array>) {
      const row = await ownedUpload(owner, uploadId);
      unexpired(row);
      const claimed = await sql`update vault_asset_uploads set state='uploading'
        where id=${uploadId} and user_id=${owner} and state='pending' and expires_at>now()
        and exists(select 1 from vault_assets where id=${row.asset_id} and user_id=${owner} and deleted_at is null) returning id`;
      if (!claimed[0]) throw new Error("Upload already started; check its status before retrying");
      try {
        const bytes = await readBoundedCipher(body, row.cipher_size);
        await verifyStoredCipher(
          (async function* () {
            yield bytes;
          })(),
          row.cipher_size,
          row.digest,
        );
        await store.put(row.object_key, bytes);
        const saved = await sql`update vault_asset_uploads set state='uploaded' where id=${uploadId}
          and user_id=${owner} and state='uploading' and expires_at>now() returning id`;
        if (!saved[0]) throw new Error("Upload reservation expired; create another reservation");
      } catch (error) {
        await sql`update vault_asset_uploads set state='pending' where id=${uploadId} and user_id=${owner} and state='uploading'`;
        throw error;
      }
    },
    async finalize(owner: string, uploadId: string) {
      const row = await ownedUpload(owner, uploadId);
      if (row.state === "ready" && row.current_revision === row.base_revision + 1)
        return { assetId: row.asset_id, revision: row.current_revision };
      unexpired(row);
      if (row.state !== "uploaded") throw new Error("Upload is not ready to finalize");
      await verifyStoredCipher(await store.get(row.object_key), row.cipher_size, row.digest);
      const published = await sql.query<{ id: string }>(
        `WITH published AS (
        UPDATE vault_assets SET current_revision=current_revision+1
        WHERE id=$1 AND user_id=$2 AND current_revision=$3 AND deleted_at IS NULL
        AND EXISTS(SELECT 1 FROM vault_asset_uploads WHERE id=$4 AND user_id=$2 AND state='uploaded' AND expires_at>now()) RETURNING id
      ) UPDATE vault_asset_uploads SET state='ready' WHERE id=$4 AND user_id=$2 AND state='uploaded'
        AND EXISTS(SELECT 1 FROM published) RETURNING id`,
        [row.asset_id, owner, row.base_revision, uploadId],
      );
      if (!published[0]) throw new Error("Asset revision changed; reload before saving");
      return { assetId: row.asset_id, revision: row.base_revision + 1 };
    },
    async list(owner: string) {
      return sql<{
        id: string;
        title: string;
        kind: string;
        current_revision: number;
      }>`select a.id,a.kind,a.current_revision,u.title,u.content_type,
        u.original_size,u.client_id,u.project_id,u.event_id,u.key_fingerprint
        from vault_assets a join vault_asset_uploads u on u.asset_id=a.id and u.user_id=a.user_id
        and u.base_revision=a.current_revision-1 and u.state='ready'
        where a.user_id=${owner} and a.deleted_at is null order by u.created_at desc`;
    },
    async read(owner: string, assetId: string) {
      const row = await current(owner, assetId);
      const bytes = await readBoundedCipher(await store.get(row.object_key), row.cipher_size);
      await verifyStoredCipher(
        (async function* () {
          yield bytes;
        })(),
        row.cipher_size,
        row.digest,
      );
      return bytes;
    },
    async delete(owner: string, assetId: string) {
      await guard("vault-asset-delete");
      id.parse(assetId);
      const rows =
        await sql`update vault_assets set deleted_at=coalesce(deleted_at,now()) where id=${assetId} and user_id=${owner} returning id`;
      if (!rows[0]) throw new Error("Asset not found");
      const uploads =
        await sql<Upload>`select * from vault_asset_uploads where asset_id=${assetId} and user_id=${owner} and state<>'deleted'`;
      if (uploads.some((row) => row.state === "uploading"))
        throw new Error("Upload still in progress; retry deletion shortly");
      for (const row of uploads) {
        await store.remove(row.object_key);
        await sql`update vault_asset_uploads set state='deleted' where id=${row.id} and user_id=${owner}`;
      }
      return { ok: true };
    },
  };
}
