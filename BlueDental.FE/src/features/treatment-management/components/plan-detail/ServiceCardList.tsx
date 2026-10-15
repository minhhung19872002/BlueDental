import { Pagination } from "antd";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatToothCodes } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import {
  DiscountCell,
  dentistOf,
  diagnosisOf,
  isLineDeletable,
  isLineEditable,
  ServiceNameCell,
  StatusCell,
  type ServiceRowActions,
} from "./serviceColumns";
import { dash, lineNetAmount, listUnitPrice, type PlanDetailRow } from "./planDetailTypes";

interface Props {
  rows: PlanDetailRow[];
  total: number;
  pagination: TablePagination;
  actions: ServiceRowActions;
  showTotal: (total: number, range: [number, number]) => string;
}

/** The table's columns, in its order; the money folds behind "Xem thêm". */
function cardRows(row: PlanDetailRow, actions: ServiceRowActions) {
  const rows: RecordCardRow[] = [
    { key: "service", label: t("Treatment:Service:Service"), value: <ServiceNameCell row={row} /> },
    { key: "dentist", label: t("Treatment:PlanDetail:Col:Dentist"), value: dentistOf(row) },
    { key: "diagnosis", label: t("Treatment:PlanDetail:Col:Diagnosis"), value: diagnosisOf(row) },
    { key: "teeth", label: t("Treatment:PlanDetail:Col:Teeth"), value: dash(formatToothCodes(row.service.teeth)) },
    { key: "status", label: t("Common:Status"), value: <StatusCell row={row} actions={actions} /> },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "price", label: t("Treatment:Pricing:UnitPrice"), value: moneyText(listUnitPrice(row.service)) },
    { key: "discount", label: t("Treatment:Pricing:Discount"), value: <DiscountCell row={row} /> },
    { key: "amount", label: t("Treatment:Pricing:NetAmount"), value: <strong>{moneyText(lineNetAmount(row.service))}</strong> },
  ];
  return { rows, moreRows };
}

/** The card head: the eye, the pencil on a line still open, and "Xóa" on a line still "Đã tạo" (R-953). */
function CardActions({ row, actions }: { row: PlanDetailRow; actions: ServiceRowActions }) {
  return (
    <span className="tp-actions">
      <button
        type="button"
        className="bd-rc-action"
        aria-label={t("Treatment:Service:ViewDetail")}
        onClick={() => actions.onView(row)}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
      {actions.onEdit && isLineEditable(row) && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Common:Edit")}
          onClick={() => actions.onEdit?.(row)}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      )}
      {actions.onDelete && isLineDeletable(row) && (
        <button
          type="button"
          className="bd-rc-action"
          aria-label={t("Common:Delete")}
          onClick={() => actions.onDelete?.(row)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** The service table at 640px and below: one card per line, its position on the head. */
export function ServiceCardList({ rows, total, pagination, actions, showTotal }: Props) {
  return (
    <div className="tp-card-list pdt-card-list">
      {rows.length === 0 && <p className="bd-rc-empty">{t("Treatment:Common:NoData")}</p>}
      <div className="bd-rc-list">
        {rows.map((row) => {
          const card = cardRows(row, actions);
          return (
            <RecordCard
              key={row.service.id}
              title={String(row.index)}
              extra={<CardActions row={row} actions={actions} />}
              rows={card.rows}
              moreRows={card.moreRows}
            />
          );
        })}
      </div>
      {total > 0 && (
        <Pagination className="tp-card-pager" {...pagination.buildConfig(total, showTotal)} />
      )}
    </div>
  );
}
