import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type {
  HistoryAction,
  HistoryEntry,
  HistoryFieldChange,
  HistorySource,
  HistoryStatusGroup,
} from "../../types/appointmentHistory";

/** The colour families the dialog paints badges, dots and stat cards in. */
export type HistoryTone = "green" | "orange" | "blue" | "red" | "gray";

export type HistoryView = "table" | "timeline";

export const ACTION_ORDER: readonly HistoryAction[] = [
  "created",
  "updated",
  "statusChanged",
  "cancelled",
  "deleted",
];

export const ACTION_META: Record<HistoryAction, { label: string; emoji: string; tone: HistoryTone }> = {
  created: { label: "Appointment:History:ActionCreated", emoji: "🟢", tone: "green" },
  updated: { label: "Appointment:History:ActionUpdated", emoji: "🟠", tone: "orange" },
  statusChanged: { label: "Appointment:History:ActionStatusChanged", emoji: "🔵", tone: "blue" },
  cancelled: { label: "Appointment:History:ActionCancelled", emoji: "🔴", tone: "red" },
  deleted: { label: "Appointment:History:ActionDeleted", emoji: "⚫", tone: "gray" },
};

export const SOURCE_LABELS: Record<HistorySource, string> = {
  web: "Web",
  mobile: "Mobile",
  api: "API",
  import: "Import",
  system: "Appointment:History:System",
  ai: "AI",
  webhook: "Webhook",
};

export const STATUS_GROUP_ORDER: readonly HistoryStatusGroup[] = [
  "scheduled",
  "arrived",
  "cancelled",
  "noShow",
];

export const STATUS_GROUP_META: Record<HistoryStatusGroup, { label: string; tone: HistoryTone }> = {
  scheduled: { label: "Appointment:Status:Scheduled2", tone: "blue" },
  arrived: { label: "Appointment:Status:Arrived", tone: "green" },
  cancelled: { label: "Appointment:Status:CancelledAlt", tone: "red" },
  noShow: { label: "Appointment:Status:Late", tone: "orange" },
};

/** Snapshot field keys, as the server names them, in words. */
const FIELD_LABELS: Record<string, string> = {
  id: "Appointment:History:AppointmentId",
  startTime: "Appointment:History:Field:StartTime",
  toTime: "Appointment:History:Field:EndTime",
  duration: "Appointment:History:Field:Duration",
  status: "Appointment:History:Field:Status",
  content: "Appointment:History:Field:Content",
  note: "Appointment:History:Field:Note",
  color: "Appointment:History:Field:Color",
  staffId: "Appointment:History:Field:Doctor",
  patientName: "Appointment:History:Field:PatientName",
  patientPhone: "Appointment:History:Field:PatientPhone",
  cancelReason: "Appointment:History:Field:CancelReason",
  cancelNote: "Appointment:History:Field:CancelNote",
};

/**
 * The diff stores a status by its enum name. Each one keeps its own word here,
 * not its bucket's: CheckedIn → InProgress must not read "Đã đến → Đã đến".
 */
const STATUS_NAME_LABELS: Record<string, string> = {
  Requested: "Appointment:Status:Scheduled2",
  Confirmed: "Appointment:Status:Confirmed",
  CheckedIn: "Appointment:Status:Arrived",
  InProgress: "Appointment:Status:InProgress",
  Completed: "Appointment:Status:Completed",
  Cancelled: "Appointment:Status:CancelledAlt",
  NoShow: "Appointment:Status:Late",
};

/** What a new appointment's row leaves out: the id, and what the dialog already says or nobody reads. */
const CREATED_HIDDEN_FIELDS = new Set(["id", "duration", "patientName", "patientPhone"]);

const DATE_TIME_FIELDS = new Set(["startTime", "toTime"]);
const EMPTY = "—";

export function actionLabel(action: HistoryAction): string {
  return t(ACTION_META[action].label);
}

export function sourceLabel(source: HistorySource): string {
  return t(SOURCE_LABELS[source]);
}

export function statusLabel(group: HistoryStatusGroup | null | undefined): string {
  return group ? t(STATUS_GROUP_META[group].label) : EMPTY;
}

export function fieldLabel(field: string): string {
  const label = FIELD_LABELS[field];
  return label ? t(label) : field;
}

/** A stored before/after value, readable: dates in clinic format, statuses in words. */
export function formatFieldValue(field: string, value: string | null): string {
  if (value === null || value === "") return EMPTY;
  if (field === "status") {
    const label = STATUS_NAME_LABELS[value];
    return label ? t(label) : value;
  }
  if (DATE_TIME_FIELDS.has(field)) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : value;
  }
  return value;
}

/** "Trễ hẹn" when nothing moved, "Đã hẹn → Trễ hẹn" when it did, "— → Đã hẹn" for a creation. */
export function statusTransition(entry: HistoryEntry): string {
  if (entry.statusBefore === entry.statusAfter && entry.statusAfter) {
    return statusLabel(entry.statusAfter);
  }
  return `${statusLabel(entry.statusBefore)} → ${statusLabel(entry.statusAfter)}`;
}

/**
 * The fields the table's "Giá trị cũ" / "Giá trị mới" columns list, one line
 * each: every edited field, or what a new appointment was set up with.
 */
export function tableChanges(entry: HistoryEntry): HistoryFieldChange[] {
  if (entry.action !== "created") return entry.diff;
  return entry.diff.filter((change) => !CREATED_HIDDEN_FIELDS.has(change.field));
}

export function formatOccurredAt(iso: string): string {
  return dayjs(iso).format("DD/MM/YYYY HH:mm:ss");
}

/** "Chrome 128 trên Windows 10", or whichever half is known. */
export function describeDevice(entry: HistoryEntry): string {
  if (entry.browser && entry.operatingSystem) {
    return t("Appointment:History:BrowserOnOS", entry.browser, entry.operatingSystem);
  }
  return entry.browser ?? entry.operatingSystem ?? EMPTY;
}

export function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : EMPTY;
}
