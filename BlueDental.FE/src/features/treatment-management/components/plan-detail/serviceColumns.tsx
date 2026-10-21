import type { ReactNode } from "react";
import type { TableColumnsType } from "antd";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { formatToothCodes } from "../../api/consultingApi";
import { SERVICE_LINE_STATUS } from "../../api/treatmentPlanApi";
import { LineMoney } from "../plan/LineMoney";
import { DiscountBreakdown } from "./DiscountBreakdown";
import { ServiceStatusMenu, type ServiceAction } from "./ServiceStatusMenu";
import { ServiceStatusPill } from "./ServiceStatusPill";
import {
  dash,
  isLineOpen,
  lineDiscountParts,
  lineNetAmount,
  listUnitPrice,
  type PlanDetailRow,
} from "./planDetailTypes";

export interface ServiceRowActions {
  onView: (row: PlanDetailRow) => void;
  /** Left out when the user may not move a line (treatmentConsultation.update). */
  onStatus?: (row: PlanDetailRow, action: ServiceAction) => void;
  /** "Chỉnh sửa". Left out when the user may not edit lines; see {@link isLineEditable}. */
  onEdit?: (row: PlanDetailRow) => void;
  /** "Xóa". Left out without treatmentConsultation.delete; shown only on lines still "Đã tạo". */
  onDelete?: (row: PlanDetailRow) => void;
}

/**
 * "Đổi trạng thái" on a row, its menu wired to {@link ServiceRowActions.onStatus};
 * only when the user may move lines and this one is still open. No "Chuyển đổi"
 * on a line whose money is masked: the dialog is all about what was paid on it.
 */
export function LineStatusMenu({
  row,
  actions,
  buttonClassName,
}: {
  row: PlanDetailRow;
  actions: ServiceRowActions;
  buttonClassName: string;
}) {
  if (!actions.onStatus || !isLineOpen(row.service)) return null;
  return (
    <ServiceStatusMenu
      service={row.service}
      buttonClassName={buttonClassName}
      converts={!row.service.moneyHidden}
      onAction={(action) => actions.onStatus?.(row, action)}
    />
  );
}

/**
 * Whether the viewer may act on the line: every line, except another doctor's
 * on a slip they see only through their own lines (BA bug 40). Their own line
 * stays theirs even when its money is masked too, without "Chi phí › Xem".
 */
export function isOwnLine(row: PlanDetailRow): boolean {
  return !row.plan.seenThroughLines || row.service.assignedToViewer;
}

/** Owner 2026-10-15 (R-953): only a line nobody has started on can be taken off the slip. */
export function isLineDeletable(row: PlanDetailRow): boolean {
  return row.service.status === SERVICE_LINE_STATUS.Created;
}

/**
 * Whether the line carries the pencil — staging's own rule, read off its
 * column builder 2026-09-24: not done, cancelled or converted, and nothing
 * paid on it yet. Never on a line whose money is masked (BA bug 40): its
 * amounts arrive as 0, so "nothing paid" cannot be told and the dialog would
 * save 0 as the price.
 */
export function isLineEditable(row: PlanDetailRow): boolean {
  const { status, paidAmount, moneyHidden } = row.service;
  const closed =
    status === SERVICE_LINE_STATUS.Done ||
    status === SERVICE_LINE_STATUS.Cancelled ||
    status === SERVICE_LINE_STATUS.Replaced;
  return !closed && !moneyHidden && paidAmount <= 0;
}

type Column = TableColumnsType<PlanDetailRow>[number];

/** Service name over the slip date — the first cell. */
export function ServiceNameCell({ row }: { row: PlanDetailRow }) {
  return (
    <div className="pdt-service">
      <span className="pdt-service-name">{row.service.serviceName}</span>
      <span className="pdt-service-date">{formatDate(row.plan.creationTime)}</span>
    </div>
  );
}

/** The status pill (read only — moving it is in Thao tác) and how many công đoạn the line has had. */
export function StatusCell({ row }: { row: PlanDetailRow }) {
  const stages = row.service.stageCount;
  return (
    <span className="pdt-line-status">
      <ServiceStatusPill service={row.service} />
      {stages > 0 && <span className="pdt-stage-count">{t("Treatment:Service:StageCount", stages)}</span>}
    </span>
  );
}

/** "Giảm giá" of a saved line — see {@link DiscountBreakdown}; masked lines get no breakdown. */
export function DiscountCell({ row }: { row: PlanDetailRow }) {
  if (row.service.moneyHidden) return <LineMoney service={row.service} value={0} />;
  return <DiscountBreakdown parts={lineDiscountParts(row.service)} />;
}

/** "Đơn giá": the giá gốc (staging 2026-09-28). */
export function UnitPriceCell({ row }: { row: PlanDetailRow }) {
  return <LineMoney service={row.service} value={listUnitPrice(row.service)} />;
}

/** "Thành tiền", after every discount. */
export function NetAmountCell({ row }: { row: PlanDetailRow }) {
  return (
    <strong>
      <LineMoney service={row.service} value={lineNetAmount(row.service)} />
    </strong>
  );
}

/** "Chẩn đoán": the line's own, else the advise it was written from. */
export function diagnosisOf(row: PlanDetailRow): string {
  return dash(row.service.diagnosisName ?? row.advise?.diagnosisName);
}

export function dentistOf(row: PlanDetailRow): string {
  return dash(row.service.dentistName ?? row.plan.dentistName);
}

function column(
  key: string,
  title: string,
  width: number,
  render: (row: PlanDetailRow) => ReactNode,
  extra: Omit<Column, "key" | "title" | "width" | "render"> = {},
): Column {
  return { key, title, width, ...extra, render: (_, row) => render(row) };
}

/**
 * Thao tác: the eye, "Đổi trạng thái" on a line still open, the pencil on a
 * line still editable, and "Xóa" on a line still "Đã tạo" — the last three on
 * the viewer's own lines only.
 */
function LineActions({ row, actions }: { row: PlanDetailRow; actions: ServiceRowActions }) {
  const own = isOwnLine(row);
  const editable = own && actions.onEdit && isLineEditable(row);
  const deletable = own && actions.onDelete && isLineDeletable(row);
  return (
    <span className="pdt-line-actions">
      <ActionTooltip title={t("Treatment:Service:ViewDetail")}>
        <button type="button" className="tp-eye" aria-label={t("Treatment:Service:ViewDetail")} onClick={() => actions.onView(row)}>
          <Eye size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      {own && <LineStatusMenu row={row} actions={actions} buttonClassName="tp-eye" />}
      {editable && (
        <ActionTooltip title={t("Common:Edit")}>
          <button type="button" className="tp-eye" aria-label={t("Common:Edit")} onClick={() => actions.onEdit?.(row)}>
            <Pencil size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {deletable && (
        <ActionTooltip title={t("Common:Delete")}>
          <button
            type="button"
            className="tp-eye pdt-line-delete"
            aria-label={t("Common:Delete")}
            onClick={() => actions.onDelete?.(row)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
    </span>
  );
}

/**
 * The BA's nine columns (2026-10-15): the reference's fifteen cut down, Chẩn
 * đoán moved after Bác sĩ điều trị and the status pulled out of the name cell.
 * No drag grip — the order is the slip's.
 */
export function buildServiceColumns(actions: ServiceRowActions): TableColumnsType<PlanDetailRow> {
  return [
    column("service", t("Treatment:Service:Service"), 240, (row) => <ServiceNameCell row={row} />),
    column("dentist", t("Treatment:PlanDetail:Col:Dentist"), 160, dentistOf),
    column("diagnosis", t("Treatment:PlanDetail:Col:Diagnosis"), 180, diagnosisOf),
    // Tooth numbers only — staging prints no surfaces in this column.
    column("teeth", t("Treatment:PlanDetail:Col:Teeth"), 100, (row) => dash(formatToothCodes(row.service.teeth))),
    // The widest pill ("Đang điều trị") and "N lần" beside it.
    column("status", t("Common:Status"), 156, (row) => <StatusCell row={row} />),
    column("price", t("Treatment:Pricing:UnitPrice"), 112, (row) => <UnitPriceCell row={row} />, { align: "right" }),
    column("discount", t("Treatment:Pricing:Discount"), 104, (row) => <DiscountCell row={row} />, { align: "right" }),
    column("amount", t("Treatment:Pricing:NetAmount"), 116, (row) => <NetAmountCell row={row} />, { align: "right" }),
    // Up to four 16px icons 16px apart, the 6px inner padding and the 16px edge.
    column("actions", t("Common:Actions"), 136, (row) => <LineActions row={row} actions={actions} />, {
      align: "center",
      fixed: "right",
    }),
  ];
}
