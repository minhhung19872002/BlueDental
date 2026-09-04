import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import type { ServiceLineStatus, ServiceLineVm } from "../types/mock";

/** One flat row per service line — the shape of the reference's Excel file. */
interface ServiceExportRow {
  date: string;
  patientCode: string;
  patientName: string;
  counselorName: string;
  doctorName: string;
  serviceName: string;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  ticketCode: string;
  statusLabel: string;
  branchName: string;
}

type StatusLabels = Record<ServiceLineStatus, string>;

function statusLabels(): StatusLabels {
  return {
    created: t("đã tạo"),
    inProgress: t("đang điều trị"),
    completed: t("hoàn thành"),
    cancelled: t("đã hủy"),
  };
}

function toExportRow(line: ServiceLineVm, branchName: string, labels: StatusLabels): ServiceExportRow {
  return {
    date: formatDate(line.date),
    patientCode: line.patientCode,
    patientName: line.patientName,
    counselorName: line.counselorName,
    doctorName: line.doctorName,
    serviceName: line.cancelled ? `${line.serviceName} (${t("Đã hủy")})` : line.serviceName,
    quantity: line.quantity,
    totalAmount: line.totalAmount,
    paidAmount: line.paidAmount,
    ticketCode: line.ticketCode,
    statusLabel: labels[line.status],
    branchName,
  };
}

/** Column order and headers mirror the reference export: 12 columns, raw numbers. */
function exportColumns(): { header: string; key: keyof ServiceExportRow }[] {
  return [
    { header: t("Ngày"), key: "date" },
    { header: t("Mã khách hàng"), key: "patientCode" },
    { header: t("Tên khách hàng"), key: "patientName" },
    { header: t("Nhân sự tư vấn"), key: "counselorName" },
    { header: t("Bác sĩ tiếp nhận"), key: "doctorName" },
    { header: t("Dịch vụ điều trị"), key: "serviceName" },
    { header: t("Số lượng"), key: "quantity" },
    { header: t("Thành tiền"), key: "totalAmount" },
    { header: t("Đã thanh toán"), key: "paidAmount" },
    { header: t("Mã phiếu điều trị"), key: "ticketCode" },
    { header: t("Trạng thái dịch vụ"), key: "statusLabel" },
    { header: t("Chi nhánh"), key: "branchName" },
  ];
}

/**
 * Export the "Khách hàng phát sinh dịch vụ" table the way the reference does:
 * every service on its own row, amounts as plain numbers, plus the ticket code,
 * service status and branch that the on-screen table does not show.
 */
export function exportServiceLines(lines: ServiceLineVm[], branchName: string, filename: string): void {
  const labels = statusLabels();
  const rows = lines.map((line) => toExportRow(line, branchName, labels));
  exportToExcel<ServiceExportRow>(rows, exportColumns(), filename);
}
