import { parseLabels } from "@/lib/utils";
import type {
  AlertRow,
  CalendarEvent,
  CalendarSource,
  Client,
  EmailLog,
  Minute,
  Note,
  Profile,
  Project,
  Task,
  VaultNoteMeta,
} from "./types";

function iso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return String(v);
}

function reqIso(v: unknown): string {
  return iso(v) ?? new Date().toISOString();
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    userId: String(row.user_id),
    timezone: String(row.timezone ?? "Asia/Kolkata"),
    displayName: str(row.display_name),
    seededAt: iso(row.seeded_at),
    vaultPublicKey: str(row.vault_public_key),
    vaultPrivateKeyArmored: str(row.vault_private_key_armored),
    vaultKeyCreatedAt: iso(row.vault_key_created_at),
    alertEmail: str(row.alert_email),
    alertsDueSoon: bool(row.alerts_due_soon),
    alertsOverdue: bool(row.alerts_overdue),
    alertsMeeting: bool(row.alerts_meeting),
  };
}

export function mapClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name),
    color: String(row.color ?? "sage"),
    email: str(row.email),
    notes: str(row.notes),
    archived: bool(row.archived),
    isSample: bool(row.is_sample),
    createdAt: reqIso(row.created_at),
  };
}

export function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name),
    slug: String(row.slug),
    description: str(row.description),
    archived: bool(row.archived),
    isSample: bool(row.is_sample),
    createdAt: reqIso(row.created_at),
  };
}

export function mapTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    notes: str(row.notes),
    columnId: String(row.column_id),
    priority: String(row.priority),
    dueAt: iso(row.due_at),
    labels: parseLabels(str(row.labels) ?? "[]"),
    position: num(row.position),
    isSample: bool(row.is_sample),
    createdAt: reqIso(row.created_at),
  };
}

export function mapSource(row: Record<string, unknown>): CalendarSource {
  return {
    id: String(row.id),
    provider: String(row.provider),
    name: String(row.name),
    icsUrl: str(row.ics_url),
    enabled: bool(row.enabled),
    lastSyncedAt: iso(row.last_synced_at),
    lastError: str(row.last_error),
  };
}

export function mapEvent(row: Record<string, unknown>): CalendarEvent {
  let attendees: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(row.attendees ?? "[]"));
    if (Array.isArray(parsed)) attendees = parsed.map(String);
  } catch {
    attendees = [];
  }
  return {
    id: String(row.id),
    sourceId: str(row.source_id),
    sourceProvider: String(row.source_provider),
    externalId: str(row.external_id),
    title: String(row.title),
    description: str(row.description),
    location: str(row.location),
    startsAt: reqIso(row.starts_at),
    endsAt: iso(row.ends_at),
    allDay: bool(row.all_day),
    attendees,
    projectId: str(row.project_id),
    isSample: bool(row.is_sample),
  };
}

export function mapMinute(row: Record<string, unknown>): Minute {
  return {
    id: String(row.id),
    eventId: str(row.event_id),
    projectId: str(row.project_id),
    title: String(row.title),
    attendees: String(row.attendees ?? ""),
    body: String(row.body ?? ""),
    createdAt: reqIso(row.created_at),
    updatedAt: reqIso(row.updated_at),
  };
}

export function mapNote(
  row: Record<string, unknown>,
  tags: string[] = [],
): Note {
  return {
    id: String(row.id),
    projectId: str(row.project_id),
    title: String(row.title),
    body: String(row.body ?? ""),
    tags,
    createdAt: reqIso(row.created_at),
    updatedAt: reqIso(row.updated_at),
  };
}

export function mapVault(row: Record<string, unknown>): VaultNoteMeta {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: reqIso(row.created_at),
    updatedAt: reqIso(row.updated_at),
  };
}

export function mapAlert(row: Record<string, unknown>): AlertRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    title: String(row.title),
    body: String(row.body),
    entityType: str(row.entity_type),
    entityId: str(row.entity_id),
    scheduledFor: reqIso(row.scheduled_for),
    sentAt: iso(row.sent_at),
    status: String(row.status),
  };
}

export function mapEmail(row: Record<string, unknown>): EmailLog {
  return {
    id: String(row.id),
    toAddress: String(row.to_address),
    fromAddress: String(row.from_address),
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status),
    createdAt: reqIso(row.created_at),
  };
}
