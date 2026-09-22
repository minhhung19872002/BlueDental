import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { excelColumnWidths, exportToExcel } from "@/utils/exportExcel";
import type { ServiceLineDto } from "../api/clinicReportApi";
type ServiceLineStatus = "created" | "inProgress" | "completed" | "cancelled";

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

function toExportRow(line: ServiceLineDto, labels: StatusLabels): ServiceExportRow {
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
    statusLabel: labels[line.status as ServiceLineStatus] ?? line.status,
    branchName: line.branchName,
  };
}

/** The reference downloads `khach-hang-phat-sinh-dich-vu.xlsx` whatever the period. */
export const SERVICE_EXPORT_FILENAME = "khach-hang-phat-sinh-dich-vu";

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

/** `<cols>` of the reference download, in Excel width units. */
const SERVICE_EXPORT_WIDTHS = [14, 16, 24, 22, 22, 28, 12, 16, 16, 18, 18, 20];

/**
 * Export the "Khách hàng phát sinh dịch vụ" table the way the reference does:
 * every service on its own row, amounts as plain numbers, plus the ticket code,
 * service status and branch that the on-screen table does not show. The
 * reference file is server-generated: one sheet named after the table, the
 * header on row 1 (no title rows) and fixed column widths.
 */
export function exportServiceLines(lines: ServiceLineDto[]): void {
  const labels = statusLabels();
  const rows = lines.map((line) => toExportRow(line, labels));
  exportToExcel<ServiceExportRow>(rows, exportColumns(), SERVICE_EXPORT_FILENAME, {
    sheetName: t("Khách hàng phát sinh dịch vụ"),
    columnWidths: excelColumnWidths(SERVICE_EXPORT_WIDTHS),
  });
}
