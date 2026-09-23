import { t } from "@/lib/i18n";
import { downloadBlob } from "@/utils/download";
import { exportToExcel, type ExportColumn } from "@/utils/exportExcel";
import type { HistoryEntry } from "../../types/appointmentHistory";
import {
  actionLabel,
  describeDevice,
  fieldLabel,
  formatFieldValue,
  formatOccurredAt,
  sourceLabel,
  statusLabel,
} from "./historyLabels";

export type HistoryExportFormat = "csv" | "excel" | "json";

/** One flat line per history row, every column a person could ask about. */
interface ExportRow {
  occurredAt: string;
  action: string;
  statusBefore: string;
  statusAfter: string;
  changedFields: string;
  changes: string;
  actor: string;
  userName: string;
  role: string;
  source: string;
  ip: string;
  device: string;
  important: string;
  appointmentId: string;
  appointmentTime: string;
  doctor: string;
  content: string;
  note: string;
  patient: string;
}

function buildRow(entry: HistoryEntry): ExportRow {
  const snapshot = entry.after ?? entry.before;
  return {
    occurredAt: formatOccurredAt(entry.occurredAt),
    action: actionLabel(entry.action),
    statusBefore: statusLabel(entry.statusBefore),
    statusAfter: statusLabel(entry.statusAfter),
    changedFields: entry.changedFields.map(fieldLabel).join(", "),
    changes: entry.diff
      .map(
        (d) =>
          `${fieldLabel(d.field)}: ${formatFieldValue(d.field, d.before)} → ${formatFieldValue(d.field, d.after)}`,
      )
      .join("; "),
    actor: entry.actorName,
    userName: entry.actorUserName ?? "",
    role: entry.actorRole ?? "",
    source: sourceLabel(entry.source),
    ip: entry.ipAddress ?? "",
    device: describeDevice(entry),
    important: entry.isImportant ? t("Appointment:History:Export:Yes") : t("Appointment:History:Export:No"),
    appointmentId: entry.appointmentId,
    appointmentTime: snapshot ? formatFieldValue("startTime", snapshot.startTime) : "",
    doctor: snapshot?.staffName ?? "",
    content: snapshot?.content ?? "",
    note: snapshot?.note ?? "",
    patient: snapshot?.patientName ?? "",
  };
}

function columns(): ExportColumn<ExportRow>[] {
  return [
    { header: t("Appointment:History:Export:Time"), key: "occurredAt" },
    { header: t("Appointment:History:Export:Action"), key: "action" },
    { header: t("Appointment:History:Export:StatusBefore"), key: "statusBefore" },
    { header: t("Appointment:History:Export:StatusAfter"), key: "statusAfter" },
    { header: t("Appointment:History:Export:ChangedFields"), key: "changedFields" },
    { header: t("Appointment:History:Export:Changes"), key: "changes" },
    { header: t("Appointment:History:Export:Actor"), key: "actor" },
    { header: t("Appointment:History:Export:Username"), key: "userName" },
    { header: t("Appointment:History:Export:Role"), key: "role" },
    { header: t("Appointment:History:Export:Source"), key: "source" },
    { header: "IP", key: "ip" },
    { header: t("Appointment:History:Export:Device"), key: "device" },
    { header: t("Appointment:History:Export:Important"), key: "important" },
    { header: t("Appointment:History:Export:AppointmentId"), key: "appointmentId" },
    { header: t("Appointment:History:Export:AppointmentTime"), key: "appointmentTime" },
    { header: t("Appointment:History:Export:Doctor"), key: "doctor" },
    { header: t("Appointment:History:Export:Content"), key: "content" },
    { header: t("Appointment:History:Export:Note"), key: "note" },
    { header: t("Appointment:History:Export:Patient"), key: "patient" },
  ];
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(rows: ExportRow[], filename: string) {
  const cols = columns();
  const lines = [
    cols.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row) => cols.map((c) => csvCell(row[c.key])).join(",")),
  ];
  // The BOM makes Excel read the Vietnamese as UTF-8 instead of guessing.
  const blob = new Blob(["﻿", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filename}.csv`);
}

/** JSON keeps everything, snapshots included, for anyone reading it by machine. */
function exportJson(entries: HistoryEntry[], filename: string) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

export function exportHistory(entries: HistoryEntry[], format: HistoryExportFormat, filename: string) {
  if (format === "json") {
    exportJson(entries, filename);
    return;
  }
  const rows = entries.map(buildRow);
  if (format === "csv") {
    exportCsv(rows, filename);
    return;
  }
  exportToExcel(rows, columns(), filename);
}
