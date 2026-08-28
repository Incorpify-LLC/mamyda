import type { ClientColor, Priority, TaskColumnId } from "@/lib/columns";

export type Profile = {
  userId: string;
  timezone: string;
  displayName: string | null;
  seededAt: string | null;
  vaultPublicKey: string | null;
  vaultPrivateKeyArmored: string | null;
  vaultKeyCreatedAt: string | null;
  alertEmail: string | null;
  alertsDueSoon: boolean;
  alertsOverdue: boolean;
  alertsMeeting: boolean;
};

export type Client = {
  id: string;
  name: string;
  color: ClientColor | string;
  email: string | null;
  notes: string | null;
  archived: boolean;
  isSample: boolean;
  createdAt: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  description: string | null;
  archived: boolean;
  isSample: boolean;
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  notes: string | null;
  columnId: TaskColumnId | string;
  priority: Priority | string;
  dueAt: string | null;
  labels: string[];
  position: number;
  isSample: boolean;
  createdAt: string;
};

export type CalendarSource = {
  id: string;
  provider: string;
  name: string;
  icsUrl: string | null;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type CalendarEvent = {
  id: string;
  sourceId: string | null;
  sourceProvider: string;
  externalId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  attendees: string[];
  projectId: string | null;
  isSample: boolean;
};

export type Minute = {
  id: string;
  eventId: string | null;
  projectId: string | null;
  title: string;
  attendees: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type VaultNoteMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AlertRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  scheduledFor: string;
  sentAt: string | null;
  status: string;
};

export type EmailLog = {
  id: string;
  toAddress: string;
  fromAddress: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
};

export type WorkspaceSnapshot = {
  profile: Profile;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
};
