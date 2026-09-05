import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { statusGroupOfName } from "../../api/appointmentHistoryAdapters";
import type {
  HistoryAction,
  HistoryEntry,
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
  created: { label: "Tạo mới", emoji: "🟢", tone: "green" },
  updated: { label: "Cập nhật", emoji: "🟠", tone: "orange" },
  statusChanged: { label: "Đổi trạng thái", emoji: "🔵", tone: "blue" },
  cancelled: { label: "Hủy", emoji: "🔴", tone: "red" },
  deleted: { label: "Xóa", emoji: "⚫", tone: "gray" },
};

export const SOURCE_ORDER: readonly HistorySource[] = [
  "web",
  "mobile",
  "api",
  "import",
  "system",
  "ai",
  "webhook",
];

export const SOURCE_LABELS: Record<HistorySource, string> = {
  web: "Web",
  mobile: "Mobile",
  api: "API",
  import: "Import",
  system: "Hệ thống",
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
  scheduled: { label: "Đã hẹn", tone: "blue" },
  arrived: { label: "Đã đến", tone: "green" },
  cancelled: { label: "Đã huỷ", tone: "red" },
  noShow: { label: "Trễ hẹn", tone: "orange" },
};

/** Snapshot field keys, as the server names them, in words. */
const FIELD_LABELS: Record<string, string> = {
  startTime: "Thời gian bắt đầu",
  toTime: "Thời gian kết thúc",
  duration: "Thời lượng (phút)",
  status: "Trạng thái",
  content: "Nội dung",
  note: "Ghi chú",
  color: "Màu",
  staffId: "Bác sĩ",
  patientName: "Tên bệnh nhân",
  patientPhone: "SĐT bệnh nhân",
  cancelReason: "Lý do huỷ",
  cancelNote: "Ghi chú huỷ",
};

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
    const group = statusGroupOfName(value);
    return group ? statusLabel(group) : value;
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

const CREATED_FIELDS_SHOWN = 3;

/** The table's "Before → After" cell: what a creation added, or each edit's old → new. */
export function summarizeDiff(entry: HistoryEntry): string {
  if (entry.diff.length === 0) return EMPTY;
  if (entry.action === "created") {
    return entry.diff
      .slice(0, CREATED_FIELDS_SHOWN)
      .map((d) => `+ ${d.field}`)
      .join(" · ");
  }
  return entry.diff
    .map((d) => `${formatFieldValue(d.field, d.before)} → ${formatFieldValue(d.field, d.after)}`)
    .join(" · ");
}

export function formatOccurredAt(iso: string): string {
  return dayjs(iso).format("DD/MM/YYYY HH:mm:ss");
}

/** "Chrome 128 trên Windows 10", or whichever half is known. */
export function describeDevice(entry: HistoryEntry): string {
  if (entry.browser && entry.operatingSystem) {
    return t("{0} trên {1}", entry.browser, entry.operatingSystem);
  }
  return entry.browser ?? entry.operatingSystem ?? EMPTY;
}

export function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : EMPTY;
}
