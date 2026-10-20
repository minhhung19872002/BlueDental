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
        {t("Operations:PatientCreatedAt")}: {formatDate(row.patientCreatedAt)}
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
      {completed ? t("Operations:CompletedServices") : t("Operations:SeparateSalesServices")}
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
      title: t("Operations:ExcelDateOp"),
      width: 120,
      onCell: span("date"),
      render: (_, row) => <span className="bd-cat-num">{formatDate(row.occurredAt)}</span>,
    },
    {
      key: "patient",
      title: t("Operations:PatientCol"),
      width: 220,
      onCell: span("patient"),
      render: (_, row) => patientCell(row),
    },
    { key: "branch", title: t("Operations:BranchCol"), dataIndex: "branchName", width: 160 },
    { key: "service", title: t("Operations:ServiceCol"), dataIndex: "serviceName", width: 200 },
    { key: "group", title: t("Operations:ServiceGroupCol"), dataIndex: "serviceGroupName", width: 140 },
    {
      key: "classification",
      title: t("Operations:CategoryCol"),
      width: 200,
      render: (_, row) => classificationCell(row),
    },
    {
      key: "dentist1",
      title: t("Operations:Diagnosis1"),
      width: 150,
      render: (_, row) => dash(row.diagnosingDentistName),
    },
    {
      key: "diagnosis2",
      title: t("Operations:Diagnosis2"),
      width: 150,
      render: (_, row) => dash(row.secondDiagnosisName),
    },
    {
      key: "consultant1",
      title: t("Operations:Consultant1"),
      width: 150,
      render: (_, row) => dash(row.consultantName),
    },
    {
      key: "consultant2",
      title: t("Operations:Consultant2"),
      width: 150,
      render: (_, row) => dash(row.secondConsultantName),
    },
    {
      key: "treating",
      title: t("Operations:DentistCol"),
      width: 150,
      render: (_, row) => dash(row.treatingDentistName),
    },
    { key: "teeth", title: t("Operations:TeethCol"), width: 96, render: (_, row) => dash(row.teeth) },
    {
      key: "stage",
      title: t("Operations:SlipDetail"),
      width: 140,
      render: (_, row) => dash(row.stageName),
    },
    {
      key: "price",
      title: t("Operations:PriceCol"),
      width: 120,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{formatMoney(row.price)}</span>,
    },
    {
      key: "quantity",
      title: t("Operations:QtyCol"),
      width: 76,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{row.quantity}</span>,
    },
    {
      key: "discount",
      title: t("Operations:DiscountCol"),
      width: 120,
      align: "right",
      render: (_, row) => <span className="bd-cat-num">{formatMoney(row.discountAmount)}</span>,
    },
    {
      key: "doctorAmount",
      title: t("Operations:DoctorAmountCol"),
      width: 132,
      align: "right",
      render: (_, row) => (
        <span className="bd-cat-num bd-semibold">{formatMoney(row.doctorAmount)}</span>
      ),
    },
    {
      key: "note",
      title: t("Operations:NoteCol"),
      width: 180,
      render: (_, row) => dash(row.serviceNote),
    },
    { key: "taxKind", title: t("Operations:TaxKind"), width: 88, render: (_, row) => dash(row.taxKind) },
    {
      key: "taxPercent",
      title: t("Operations:TaxPercent"),
      width: 80,
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
    title: t("Operations:Occupation"),
    width: 130,
    render: (_, row: ServiceLineRow) => dash(row.occupation),
  });

  // Tên chi tiết follows the service.
  columns.splice(columns.findIndex((c) => c.key === "group"), 0, {
    key: "detail",
    title: t("Operations:DetailName"),
    width: 150,
    render: (_, row: ServiceLineRow) => dash(row.detailName),
  });

  // The two sync/invoice states follow the classification.
  const afterClass = columns.findIndex((c) => c.key === "classification") + 1;
  columns.splice(
    afterClass,
    0,
    {
      key: "sync",
      title: t("Operations:SyncStatus"),
      width: 148,
      render: (_, row: ServiceLineRow) => dash(row.syncStatus),
    },
    {
      key: "invoice",
      title: t("Operations:InvoiceExportStatus"),
      width: 184,
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
      title: t("Operations:SupportDentist"),
      width: 150,
      render: (_, row: ServiceLineRow) => dash(row.supportingDentistName),
    },
    {
      key: "assistant",
      title: t("Operations:Assistant"),
      width: 150,
      render: (_, row: ServiceLineRow) => dash(row.assistantName),
    },
  );

  return columns;
}
