/**
 * Lịch sử thay đổi lịch hẹn — what the server keeps for every write to an
 * appointment, and the shape the history dialog works with.
 */

export const HISTORY_ACTION_CODE = {
  created: 1,
  updated: 2,
  statusChanged: 3,
  cancelled: 4,
  deleted: 5,
} as const;
export type HistoryAction = keyof typeof HISTORY_ACTION_CODE;

export const HISTORY_SOURCE_CODE = {
  web: 1,
  mobile: 2,
  api: 3,
  import: 4,
  system: 5,
  ai: 6,
  webhook: 7,
} as const;
export type HistorySource = keyof typeof HISTORY_SOURCE_CODE;

/** The four buckets the dialog shows and filters statuses by. */
export type HistoryStatusGroup = "scheduled" | "arrived" | "cancelled" | "noShow";

// ---------------------------------------------------------------- server ----

export interface ServerAppointmentSnapshotDto {
  id: string;
  startTime: string;
  toTime: string;
  duration: number;
  status: number;
  note: string | null;
  content: string | null;
  color: string | null;
  staffId: string | null;
  staffName: string | null;
  branchId: string;
  patientId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  cancelReason: number | null;
  cancelNote: string | null;
  isTemporary: boolean;
}

export interface ServerFieldChangeDto {
  field: string;
  before: string | null;
  after: string | null;
}

export interface ServerAppointmentChangeLogDto {
  id: string;
  appointmentId: string;
  patientId: string | null;
  branchId: string;
  action: number;
  source: number;
  statusBefore: number | null;
  statusAfter: number | null;
  changedFields: string[];
  isImportant: boolean;
  actorUserId: string | null;
  actorName: string | null;
  actorUserName: string | null;
  actorRole: string | null;
  ipAddress: string | null;
  browser: string | null;
  operatingSystem: string | null;
  userAgent: string | null;
  occurredAt: string;
  before: ServerAppointmentSnapshotDto | null;
  after: ServerAppointmentSnapshotDto | null;
  diff: ServerFieldChangeDto[];
}

/** Dictionaries keyed by enum arrive with the enum names ("Created", "Confirmed", "Web") as keys. */
export interface ServerHistoryStatsDto {
  total: number;
  important: number;
  byAction: Record<string, number>;
  byStatusTo: Record<string, number>;
  byStatusFrom: Record<string, number>;
  bySource: Record<string, number>;
}

export interface ServerHistoryListParams {
  patientId: string;
  fromDate: string;
  toDate: string;
  actions?: number[];
  statuses?: number[];
  sources?: number[];
  actor?: string;
  keyword?: string;
  importantOnly?: boolean;
  skipCount: number;
  maxResultCount: number;
}

// ------------------------------------------------------------------ view ----

/**
 * Everything the dialog can narrow the list by. Dates are clinic days,
 * YYYY-MM-DD; the three pick-lists are multi-selects, empty meaning "all".
 */
export interface HistoryFilter {
  patientId: string;
  fromDate: string;
  toDate: string;
  actions: HistoryAction[];
  statuses: HistoryStatusGroup[];
  sources: HistorySource[];
  actor: string;
  keyword: string;
  importantOnly: boolean;
}

export interface HistoryPaging {
  skipCount: number;
  maxResultCount: number;
}

export interface HistoryFieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface HistorySnapshot {
  id: string;
  startTime: string;
  toTime: string;
  duration: number;
  status: HistoryStatusGroup;
  note: string | null;
  content: string | null;
  color: string | null;
  staffId: string | null;
  staffName: string | null;
  patientName: string | null;
  patientPhone: string | null;
  cancelReason: number | null;
  cancelNote: string | null;
  isTemporary: boolean;
}

export interface HistoryEntry {
  id: string;
  appointmentId: string;
  patientId: string | null;
  action: HistoryAction;
  source: HistorySource;
  statusBefore: HistoryStatusGroup | null;
  statusAfter: HistoryStatusGroup | null;
  changedFields: string[];
  diff: HistoryFieldChange[];
  isImportant: boolean;
  actorName: string;
  actorUserName: string | null;
  actorRole: string | null;
  isSystemActor: boolean;
  ipAddress: string | null;
  browser: string | null;
  operatingSystem: string | null;
  userAgent: string | null;
  /** ISO instant. */
  occurredAt: string;
  before: HistorySnapshot | null;
  after: HistorySnapshot | null;
}

export interface HistoryPage {
  items: HistoryEntry[];
  totalCount: number;
}

export interface HistoryStats {
  total: number;
  important: number;
  byAction: Partial<Record<HistoryAction, number>>;
  byStatusTo: Partial<Record<HistoryStatusGroup, number>>;
  bySource: Partial<Record<HistorySource, number>>;
}
