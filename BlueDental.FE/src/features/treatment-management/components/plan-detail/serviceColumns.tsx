import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { TableColumnsType } from "antd";
import { Tooltip } from "antd";
import { Eye, GripVertical, Pencil } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { formatToothCodes } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { ServiceStatusPill, type ServiceAction } from "./ServiceStatusPill";
import { renderDraftCell } from "./draftServiceCells";
import {
  advanceOn,
  dash,
  discountTooltip,
  isDraftRow,
  type PlanDetailRow,
  type ServiceTableRow,
} from "./planDetailTypes";

export interface ServiceRowActions {
  onView: (row: PlanDetailRow) => void;
  /** Left out when the user may not move a line (treatmentConsultation.update). */
  onStatus?: (row: PlanDetailRow, action: ServiceAction) => void;
  /**
   * "Chỉnh sửa". Left out when the user may not edit lines, or while another
   * row is already being written — one inline row at a time.
   */
  onEdit?: (row: PlanDetailRow) => void;
  /** Staging's rule for which lines carry the pencil at all. */
  canEditLine: (row: PlanDetailRow) => boolean;
}

/**
 * The columns an edited line swaps for the inline row's inputs; the rest (the
 * name with its status pill, the money it has collected) stay as they are.
 */
const EDITABLE_COLUMNS: ReadonlySet<string> = new Set([
  "diagnosis",
  "dentist",
  "teeth",
  "quantity",
  "price",
  "amount",
  "note",
  "diagnoser1",
  "diagnoser2",
  "consultant1",
  "consultant2",
  "actions",
]);

/** What the grip needs to move its row — see {@link useDragReorder}. */
export interface ServiceDragHandle {
  enabled: boolean;
  handleProps: (key: string) => {
    onPointerDown: (event: ReactPointerEvent) => void;
    style: CSSProperties;
  };
  /** The keyboard's way out: one slot up or down from where the line sits now. */
  onNudge: (row: PlanDetailRow, delta: -1 | 1) => void;
}

/**
 * The grip that starts a drag. A real button, not a decoration: the order has
 * to be reachable without a pointer, so the arrow keys move the row too.
 */
function ServiceGrip({ row, drag }: { row: PlanDetailRow; drag: ServiceDragHandle }) {
  return (
    <button
      type="button"
      className={["pdt-grip", !drag.enabled && "pdt-grip--off"].filter(Boolean).join(" ")}
      disabled={!drag.enabled}
      title={t("Treatment:Service:DragHint")}
      aria-label={t("Treatment:Service:SortLabel", row.service.serviceName ?? row.service.code)}
      {...drag.handleProps(row.service.id)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        drag.onNudge(row, event.key === "ArrowUp" ? -1 : 1);
      }}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}

type Column = TableColumnsType<ServiceTableRow>[number];

/** Service name over the slip date and the status pill — the first cell. */
export function ServiceNameCell({ row, actions }: { row: PlanDetailRow; actions: ServiceRowActions }) {
  return (
    <div className="pdt-service">
      <span className="pdt-service-name">{row.service.serviceName}</span>
      <span className="pdt-service-meta">
        <span className="pdt-service-date">{formatDate(row.plan.creationTime)}</span>
        <ServiceStatusPill
          service={row.service}
          onAction={actions.onStatus && ((action) => actions.onStatus?.(row, action))}
        />
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
    render: (_, row) => {
      if (isDraftRow(row)) return renderDraftCell(key, row.draft);
      if (row.edit && EDITABLE_COLUMNS.has(key)) return renderDraftCell(key, row.edit);
      return line(row);
    },
  };
}

/** Thao tác on a saved line: the eye, and the pencil where staging offers it. */
function LineActions({ row, actions }: { row: PlanDetailRow; actions: ServiceRowActions }) {
  const editable = actions.onEdit && actions.canEditLine(row);
  return (
    <span className="pdt-line-actions">
      <button type="button" className="tp-eye" aria-label={t("Treatment:Service:ViewDetail")} onClick={() => actions.onView(row)}>
        <Eye size={16} aria-hidden="true" />
      </button>
      {editable && (
        <ActionTooltip title={t("Common:Edit")}>
          <button
            type="button"
            className="tp-eye"
            aria-label={t("Common:Edit")}
            onClick={() => actions.onEdit?.(row)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
    </span>
  );
}

function text(key: string, titleKey: string, width: number, value: (row: PlanDetailRow) => string): Column {
  return column(key, t(titleKey), width, (row) => dash(value(row)));
}

/** The reference's fifteen columns, widths as measured on production. */
export function buildServiceColumns(
  actions: ServiceRowActions,
  drag: ServiceDragHandle,
): TableColumnsType<ServiceTableRow> {
  return [
    column("grip", "", 36, (row) => <ServiceGrip row={row} drag={drag} />, {
      align: "center",
    }),
    column("service", t("Treatment:Service:Service"), 260, (row) => <ServiceNameCell row={row} actions={actions} />),
    text("diagnosis", "Treatment:PlanDetail:Col:Diagnosis", 200, (row) => row.service.diagnosisName ?? row.advise?.diagnosisName ?? ""),
    text("dentist", "Treatment:PlanDetail:Col:Dentist", 200, (row) => row.service.dentistName ?? row.plan.dentistName ?? ""),
    // Tooth numbers only — staging prints no surfaces in this column.
    text("teeth", "Treatment:PlanDetail:Col:Teeth", 120, (row) => formatToothCodes(row.service.teeth)),
    column("quantity", t("Treatment:Pricing:Quantity"), 80, (row) => row.service.quantity, { align: "center" }),
    column("price", t("Treatment:Pricing:UnitPrice"), 170, (row) => moneyText(row.service.price), { align: "right" }),
    column("discount", t("Treatment:Pricing:TotalDiscount"), 160, (row) => <DiscountCell row={row} />, { align: "right" }),
    column("amount", t("Treatment:Pricing:NetAmount"), 170, (row) => <strong>{moneyText(row.service.effectiveAmount)}</strong>, {
      align: "right",
    }),
    column("advance", t("Treatment:Payment:Prepaid"), 160, (row) => moneyText(advanceOn(row.service)), {
      align: "right",
    }),
    text("note", "Treatment:PlanDetail:Col:Note", 200, (row) => row.service.note ?? row.advise?.note ?? ""),
    text("diagnoser1", "Treatment:PlanDetail:Col:Diagnoser1", 180, (row) => row.service.diagnoserName ?? row.advise?.staffName ?? ""),
    text("diagnoser2", "Treatment:PlanDetail:Col:Diagnoser2", 180, (row) => row.service.secondDiagnoserName ?? row.advise?.secondStaffName ?? ""),
    text("consultant1", "Treatment:PlanDetail:Col:Consultant1", 180, (row) => row.service.consultantName ?? row.plan.consultantName ?? ""),
    text("consultant2", "Treatment:PlanDetail:Col:Consultant2", 180, (row) => row.service.secondConsultantName ?? ""),
    column("actions", t("Common:Actions"), 90, (row) => <LineActions row={row} actions={actions} />, {
      align: "center",
      fixed: "right",
    }),
  ];
}
