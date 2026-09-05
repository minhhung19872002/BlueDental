import {
  HISTORY_ACTION_CODE,
  HISTORY_SOURCE_CODE,
  type HistoryAction,
  type HistoryEntry,
  type HistoryFilter,
  type HistoryPaging,
  type HistorySnapshot,
  type HistorySource,
  type HistoryStats,
  type HistoryStatusGroup,
  type ServerAppointmentChangeLogDto,
  type ServerAppointmentSnapshotDto,
  type ServerHistoryListParams,
  type ServerHistoryStatsDto,
} from "../types/appointmentHistory";

/** Server AppointmentStatus code → the dialog's four buckets. */
const STATUS_GROUP_BY_CODE: Record<number, HistoryStatusGroup> = {
  1: "scheduled",
  2: "scheduled",
  3: "arrived",
  4: "arrived",
  5: "arrived",
  6: "cancelled",
  7: "noShow",
};

/** The diff stores statuses by enum name; same buckets. */
const STATUS_GROUP_BY_NAME: Record<string, HistoryStatusGroup> = {
  Requested: "scheduled",
  Confirmed: "scheduled",
  CheckedIn: "arrived",
  InProgress: "arrived",
  Completed: "arrived",
  Cancelled: "cancelled",
  NoShow: "noShow",
};

const STATUS_CODES_BY_GROUP: Record<HistoryStatusGroup, number[]> = {
  scheduled: [1, 2],
  arrived: [3, 4, 5],
  cancelled: [6],
  noShow: [7],
};

function invert<K extends string>(map: Record<K, number>): Record<number, K> {
  const out: Record<number, K> = {};
  for (const key of Object.keys(map) as K[]) out[map[key]] = key;
  return out;
}

const ACTION_BY_CODE = invert(HISTORY_ACTION_CODE);
const SOURCE_BY_CODE = invert(HISTORY_SOURCE_CODE);

export function statusGroupOfCode(code: number | null | undefined): HistoryStatusGroup | null {
  return code == null ? null : (STATUS_GROUP_BY_CODE[code] ?? null);
}

export function statusGroupOfName(name: string | null | undefined): HistoryStatusGroup | null {
  return name ? (STATUS_GROUP_BY_NAME[name] ?? null) : null;
}

/** An empty pick-list means "all": leave the parameter out. */
function codes(values: number[]): number[] | undefined {
  return values.length > 0 ? values : undefined;
}

function blank(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toServerListParams(
  filter: HistoryFilter,
  paging: HistoryPaging,
): ServerHistoryListParams {
  return {
    patientId: filter.patientId,
    fromDate: filter.fromDate,
    toDate: filter.toDate,
    actions: codes(filter.actions.map((action) => HISTORY_ACTION_CODE[action])),
    statuses: codes(filter.statuses.flatMap((group) => STATUS_CODES_BY_GROUP[group])),
    sources: codes(filter.sources.map((source) => HISTORY_SOURCE_CODE[source])),
    actor: blank(filter.actor),
    keyword: blank(filter.keyword),
    importantOnly: filter.importantOnly || undefined,
    skipCount: paging.skipCount,
    maxResultCount: paging.maxResultCount,
  };
}

function adaptSnapshot(dto: ServerAppointmentSnapshotDto | null): HistorySnapshot | null {
  if (!dto) return null;
  return {
    id: dto.id,
    startTime: dto.startTime,
    toTime: dto.toTime,
    duration: dto.duration,
    status: STATUS_GROUP_BY_CODE[dto.status] ?? "scheduled",
    note: dto.note,
    content: dto.content,
    color: dto.color,
    staffId: dto.staffId,
    staffName: dto.staffName,
    patientName: dto.patientName,
    patientPhone: dto.patientPhone,
    cancelReason: dto.cancelReason,
    cancelNote: dto.cancelNote,
    isTemporary: dto.isTemporary,
  };
}

/**
 * @param systemActorLabel what to call a row nobody signed (backfill, jobs);
 * injected so this stays a pure function.
 */
export function adaptHistoryEntry(
  dto: ServerAppointmentChangeLogDto,
  systemActorLabel: string,
): HistoryEntry {
  const actorName = blank(dto.actorName) ?? blank(dto.actorUserName);
  return {
    id: dto.id,
    appointmentId: dto.appointmentId,
    patientId: dto.patientId,
    action: ACTION_BY_CODE[dto.action] ?? "updated",
    source: SOURCE_BY_CODE[dto.source] ?? "system",
    statusBefore: statusGroupOfCode(dto.statusBefore),
    statusAfter: statusGroupOfCode(dto.statusAfter),
    changedFields: dto.changedFields ?? [],
    diff: (dto.diff ?? []).map((d) => ({ field: d.field, before: d.before, after: d.after })),
    isImportant: dto.isImportant,
    actorName: actorName ?? systemActorLabel,
    actorUserName: dto.actorUserName,
    actorRole: dto.actorRole,
    isSystemActor: actorName === undefined,
    ipAddress: dto.ipAddress,
    browser: dto.browser,
    operatingSystem: dto.operatingSystem,
    userAgent: dto.userAgent,
    occurredAt: dto.occurredAt,
    before: adaptSnapshot(dto.before),
    after: adaptSnapshot(dto.after),
  };
}

/**
 * The stats dictionaries are keyed by enum, which System.Text.Json writes as
 * the enum's name ("Created", "Confirmed", "Web"); a numeric key is accepted
 * too so a serializer change cannot empty the cards.
 */
function keyed<K extends string>(
  key: string,
  byCode: Record<number, K>,
  byName: Record<string, K>,
): K | null {
  const code = Number(key);
  return Number.isNaN(code) ? (byName[key] ?? null) : (byCode[code] ?? null);
}

function byEnumName<K extends string>(codes: Record<K, number>): Record<string, K> {
  const out: Record<string, K> = {};
  for (const key of Object.keys(codes) as K[]) {
    out[key.charAt(0).toUpperCase() + key.slice(1)] = key;
  }
  return out;
}

const ACTION_BY_NAME = byEnumName(HISTORY_ACTION_CODE);
const SOURCE_BY_NAME = byEnumName(HISTORY_SOURCE_CODE);

function regroup<K extends string>(
  counts: Record<string, number> | undefined,
  keyOf: (key: string) => K | null,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [key, count] of Object.entries(counts ?? {})) {
    const group = keyOf(key);
    if (group) out[group] = (out[group] ?? 0) + count;
  }
  return out;
}

export function adaptHistoryStats(dto: ServerHistoryStatsDto): HistoryStats {
  return {
    total: dto.total,
    important: dto.important,
    byAction: regroup<HistoryAction>(dto.byAction, (key) => keyed(key, ACTION_BY_CODE, ACTION_BY_NAME)),
    byStatusTo: regroup<HistoryStatusGroup>(dto.byStatusTo, (key) =>
      keyed(key, STATUS_GROUP_BY_CODE, STATUS_GROUP_BY_NAME),
    ),
    bySource: regroup<HistorySource>(dto.bySource, (key) => keyed(key, SOURCE_BY_CODE, SOURCE_BY_NAME)),
  };
}
