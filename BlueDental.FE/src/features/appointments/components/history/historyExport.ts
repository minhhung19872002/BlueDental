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
    important: entry.isImportant ? t("Có") : t("Không"),
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
    { header: t("Thời gian"), key: "occurredAt" },
    { header: t("Hành động"), key: "action" },
    { header: t("Trạng thái trước"), key: "statusBefore" },
    { header: t("Trạng thái sau"), key: "statusAfter" },
    { header: t("Các trường thay đổi"), key: "changedFields" },
    { header: t("Thay đổi"), key: "changes" },
    { header: t("Người thực hiện"), key: "actor" },
    { header: t("Tên đăng nhập"), key: "userName" },
    { header: t("Vai trò"), key: "role" },
    { header: t("Nguồn"), key: "source" },
    { header: "IP", key: "ip" },
    { header: t("Thiết bị"), key: "device" },
    { header: t("Quan trọng"), key: "important" },
    { header: t("Mã lịch hẹn"), key: "appointmentId" },
    { header: t("Thời gian hẹn"), key: "appointmentTime" },
    { header: t("Bác sĩ"), key: "doctor" },
    { header: t("Nội dung"), key: "content" },
    { header: t("Ghi chú"), key: "note" },
    { header: t("Bệnh nhân"), key: "patient" },
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
