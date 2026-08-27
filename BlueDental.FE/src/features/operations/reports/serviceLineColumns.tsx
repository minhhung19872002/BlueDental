import type { ColumnsType } from "antd/es/table";
import { SALES_CATEGORY, type ServiceLineRow } from "../api/operationReportApi";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";
import { formatDash as dash, formatDate } from "@/utils/format";

/**
 * The columns Hoàn thành theo dịch vụ and Truy cập share.
 *
 * Both read the same service lines; Truy cập simply shows more of them, so the
 * common ones are built once here and each screen takes the slice it needs.
 */

/** Patient cell: the code and name, with when the record was opened underneath. */
function patientCell(row: ServiceLineRow) {
  return (
    <span className="bd-ops-patient">
      <span className="bd-ops-patient-name">
        [{row.patientCode}] - {row.patientName}
      </span>
      <span className="bd-ops-patient-since">
        {t("Ngày tạo")}: {formatDate(row.patientCreatedAt)}
      </span>
    </span>
  );
}

function classificationCell(row: ServiceLineRow) {
  const completed = row.classification === SALES_CATEGORY.completed;

  return (
    <span
      className={cn(
        "bd-ops-pill",
        completed ? "bd-ops-pill--done" : "bd-ops-pill--own",
      )}
    >
      {completed ? t("Dịch vụ đã hoàn thành") : t("Dịch vụ tính doanh số riêng")}
    </span>
  );
}

/**
 * How the two money tables group: one block per day of work, and inside it one
 * per patient — so a patient who had three things done that day names himself
 * once, against all three.
 */
export interface ServiceLineSpans {
  /** Rows in the order they are drawn, so a row can find its own index. */
  indexOf: (row: ServiceLineRow) => number;
  date: number[];
  patient: number[];
}

export function serviceLineSpanKeys() {
  return [
    (row: ServiceLineRow) => row.occurredAt.slice(0, 10),
    (row: ServiceLineRow) => `${row.occurredAt.slice(0, 10)}|${row.patientCode}`,
  ];
}

/** Columns Hoàn thành theo dịch vụ shows. */
export function serviceCompletionColumns(spans?: ServiceLineSpans): ColumnsType<ServiceLineRow> {
  const span = (of: "date" | "patient") =>
    spans
      ? (row: ServiceLineRow) => ({ rowSpan: spans[of][spans.indexOf(row)] })
      : undefined;

  return [
    {
      key: "date",
      title: t("Ngày thao tác"),
      width: 140,
      onCell: span("date"),
      render: (_, row) => <span className="bd-cat-num">{formatDate(row.occurredAt)}</span>,
    },
    {
      key: "patient",
      title: t("Khách hàng"),
      width: 240,
      onCell: span("patient"),
      render: (_, row) => patientCell(row),
    },
    { key: "branch", title: t("Chi nhánh"), dataIndex: "branchName", width: 220 },
    { key: "service", title: t("Dịch vụ"), dataIndex: "serviceName", width: 190 },
    { key: "group", title: t("Nhóm dịch vụ"), dataIndex: "serviceGroupName", width: 180 },
    {
      key: "classification",
      title: t("Phân loại"),
      width: 230,
      render: (_, row) => classificationCell(row),
    },
    {
      key: "dentist1",
      title: t("Bác sĩ chẩn đoán 1"),
      width: 180,
      render: (_, row) => dash(row.diagnosingDentistName),
    },
    {
      key: "diagnosis2",
      title: t("Chẩn đoán 2"),
      width: 160,
      render: (_, row) => dash(row.secondDiagnosisName),
    },
    {
      key: "consultant1",
      title: t("Nhân sự tư vấn 1"),
      width: 180,
      render: (_, row) => dash(row.consultantName),
    },
    {
      key: "consultant2",
      title: t("Nhân sự tư vấn 2"),
      width: 180,
      render: (_, row) => dash(row.secondConsultantName),
    },
    {
      key: "treating",
      title: t("Bác sĩ điều trị"),
      width: 180,
      render: (_, row) => dash(row.treatingDentistName),
    },
    { key: "teeth", title: t("Răng"), width: 110, render: (_, row) => dash(row.teeth) },
    {
      key: "stage",
      title: t("Chi tiết phiếu"),
      width: 170,
      render: (_, row) => dash(row.stageName),
    },
    {
      key: "price",
      title: t("Giá dịch vụ"),
      width: 150,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{formatMoney(row.price)}</span>,
    },
    {
      key: "quantity",
      title: t("Số lượng"),
      width: 110,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{row.quantity}</span>,
    },
    {
      key: "discount",
      title: t("Tổng giảm giá"),
      width: 150,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{formatMoney(row.discountAmount)}</span>,
    },
    {
      key: "doctorAmount",
      title: t("Giá điều trị bác sĩ"),
      width: 180,
      align: "right",
      render: (_, row) => (
        <span className="bd-cat-num bd-semibold">{formatMoney(row.doctorAmount)}</span>
      ),
    },
    {
      key: "note",
      title: t("Ghi chú"),
      width: 220,
      render: (_, row) => dash(row.serviceNote),
    },
    { key: "taxKind", title: t("Loại thuế"), width: 140, render: (_, row) => dash(row.taxKind) },
    {
      key: "taxPercent",
      title: t("% Thuế"),
      width: 110,
      align: "right",
      render: (_, row) => dash(row.taxPercent),
    },
  ];
}

/** Truy cập shows everything above plus the columns below. */
export function salesAccessColumns(spans?: ServiceLineSpans): ColumnsType<ServiceLineRow> {
  const base = serviceCompletionColumns(spans);
  const at = (key: string) => base.findIndex((c) => c.key === key);

  const columns = [...base];

  // Nghề nghiệp sits between the patient and the branch.
  columns.splice(at("branch"), 0, {
    key: "occupation",
    title: t("Nghề nghiệp"),
    width: 160,
    render: (_, row: ServiceLineRow) => dash(row.occupation),
  });

  // Tên chi tiết follows the service.
  columns.splice(columns.findIndex((c) => c.key === "group"), 0, {
    key: "detail",
    title: t("Tên chi tiết"),
    width: 160,
    render: (_, row: ServiceLineRow) => dash(row.detailName),
  });

  // The two sync/invoice states follow the classification.
  const afterClass = columns.findIndex((c) => c.key === "classification") + 1;
  columns.splice(
    afterClass,
    0,
    {
      key: "sync",
      title: t("Trạng thái đồng bộ"),
      width: 180,
      render: (_, row: ServiceLineRow) => dash(row.syncStatus),
    },
    {
      key: "invoice",
      title: t("Trạng thái xuất hoá đơn"),
      width: 210,
      render: (_, row: ServiceLineRow) => dash(row.invoiceStatus),
    },
  );

  // Support staff follow the treating dentist.
  const afterTreating = columns.findIndex((c) => c.key === "treating") + 1;
  columns.splice(
    afterTreating,
    0,
    {
      key: "supporting",
      title: t("Bác sĩ hỗ trợ"),
      width: 170,
      render: (_, row: ServiceLineRow) => dash(row.supportingDentistName),
    },
    {
      key: "assistant",
      title: t("Phụ tá"),
      width: 150,
      render: (_, row: ServiceLineRow) => dash(row.assistantName),
    },
  );

  return columns;
}
