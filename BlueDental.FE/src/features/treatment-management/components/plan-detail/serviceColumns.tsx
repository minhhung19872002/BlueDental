import type { ReactNode } from "react";
import type { TableColumnsType } from "antd";
import { Tooltip } from "antd";
import { Eye, GripVertical } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { formatTeeth } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { ServiceStatusPill, type ServiceAction } from "./ServiceStatusPill";
import { renderDraftCell } from "./draftServiceCells";
import { dash, discountTooltip, isDraftRow, type PlanDetailRow, type ServiceTableRow } from "./planDetailTypes";

export interface ServiceRowActions {
  onView: (row: PlanDetailRow) => void;
  onStatus: (row: PlanDetailRow, action: ServiceAction) => void;
}

type Column = TableColumnsType<ServiceTableRow>[number];

/** Service name over the slip date and the status pill — the first cell. */
export function ServiceNameCell({ row, actions }: { row: PlanDetailRow; actions: ServiceRowActions }) {
  return (
    <div className="pdt-service">
      <span className="pdt-service-name">{row.service.serviceName}</span>
      <span className="pdt-service-meta">
        <span className="pdt-service-date">{formatDate(row.plan.creationTime)}</span>
        <ServiceStatusPill service={row.service} onAction={(action) => actions.onStatus(row, action)} />
      </span>
    </div>
  );
}

/** "Tổng giảm giá": dotted underline, the discount rule on hover. */
export function DiscountCell({ row }: { row: PlanDetailRow }) {
  return (
    <Tooltip title={discountTooltip(row.service)}>
      <span className="pdt-discount">{moneyText(row.service.discountAmount)}</span>
    </Tooltip>
  );
}

/**
 * One column: a saved line renders through `line`, the inline new row through
 * the draft cell registered under the same key.
 */
function column(
  key: string,
  title: string,
  width: number,
  line: (row: PlanDetailRow) => ReactNode,
  extra: Omit<Column, "key" | "title" | "width" | "render"> = {},
): Column {
  return {
    key,
    title,
    width,
    ...extra,
    render: (_, row) => (isDraftRow(row) ? renderDraftCell(key, row.draft) : line(row)),
  };
}

function text(key: string, title: string, width: number, value: (row: PlanDetailRow) => string): Column {
  return column(key, t(title), width, (row) => dash(value(row)));
}

/** The reference's fifteen columns, widths as measured on production. */
export function buildServiceColumns(actions: ServiceRowActions): TableColumnsType<ServiceTableRow> {
  return [
    column("grip", "", 36, () => <GripVertical size={16} className="pdt-grip" aria-hidden="true" />, {
      align: "center",
    }),
    column("service", t("Dịch vụ"), 260, (row) => <ServiceNameCell row={row} actions={actions} />),
    text("diagnosis", "Chẩn đoán", 200, (row) => row.service.diagnosisName ?? row.advise?.diagnosisName ?? ""),
    text("dentist", "Bác sĩ điều trị", 200, (row) => row.service.dentistName ?? row.plan.dentistName ?? ""),
    text("teeth", "Răng", 120, (row) => formatTeeth(row.service.teeth)),
    column("quantity", t("Số lượng"), 80, (row) => row.service.quantity, { align: "center" }),
    column("price", t("Đơn giá"), 170, (row) => moneyText(row.service.price), { align: "right" }),
    column("discount", t("Tổng giảm giá"), 160, (row) => <DiscountCell row={row} />, { align: "right" }),
    column("amount", t("Thành tiền"), 170, (row) => <strong>{moneyText(row.service.effectiveAmount)}</strong>, {
      align: "right",
    }),
    text("note", "Ghi chú", 200, (row) => row.service.note ?? row.advise?.note ?? ""),
    text("diagnoser1", "Bác sĩ chẩn đoán 1", 180, (row) => row.service.diagnoserName ?? row.advise?.staffName ?? ""),
    text("diagnoser2", "Chẩn đoán 2", 180, (row) => row.service.secondDiagnoserName ?? row.advise?.secondStaffName ?? ""),
    text("consultant1", "Nhân sự tư vấn 1", 180, (row) => row.service.consultantName ?? row.plan.consultantName ?? ""),
    text("consultant2", "Nhân sự tư vấn 2", 180, (row) => row.service.secondConsultantName ?? ""),
    column(
      "actions",
      t("Thao tác"),
      70,
      (row) => (
        <button type="button" className="tp-eye" aria-label={t("Xem chi tiết")} onClick={() => actions.onView(row)}>
          <Eye size={16} aria-hidden="true" />
        </button>
      ),
      { align: "center", fixed: "right" },
    ),
  ];
}
