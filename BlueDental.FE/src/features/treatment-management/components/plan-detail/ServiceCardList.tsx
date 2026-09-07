import { Pagination } from "antd";
import { Eye } from "lucide-react";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { DiscountCell, ServiceNameCell, type ServiceRowActions } from "./serviceColumns";
import { dash, type PlanDetailRow } from "./planDetailTypes";

interface Props {
  rows: PlanDetailRow[];
  total: number;
  pagination: TablePagination;
  actions: ServiceRowActions;
  showTotal: (total: number, range: [number, number]) => string;
}

/** The first four columns stay visible; the rest fold behind "Xem thêm". */
function cardRows(row: PlanDetailRow, actions: ServiceRowActions) {
  const rows: RecordCardRow[] = [
    { key: "service", label: t("Dịch vụ"), value: <ServiceNameCell row={row} actions={actions} /> },
    { key: "diagnosis", label: t("Chẩn đoán"), value: dash(row.advise?.diagnosisName) },
    { key: "dentist", label: t("Bác sĩ điều trị"), value: dash(row.plan.dentistName) },
    { key: "teeth", label: t("Răng"), value: formatTeeth(row.service.teeth) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "quantity", label: t("Số lượng"), value: row.service.quantity },
    { key: "price", label: t("Đơn giá"), value: moneyText(row.service.price) },
    { key: "discount", label: t("Tổng giảm giá"), value: <DiscountCell row={row} /> },
    { key: "amount", label: t("Thành tiền"), value: <strong>{moneyText(row.service.effectiveAmount)}</strong> },
    { key: "note", label: t("Ghi chú"), value: dash(row.advise?.note) },
    { key: "diagnoser1", label: t("Bác sĩ chẩn đoán 1"), value: dash(row.advise?.staffName) },
    { key: "diagnoser2", label: t("Chẩn đoán 2"), value: dash(row.advise?.secondStaffName) },
    { key: "consultant1", label: t("Nhân sự tư vấn 1"), value: dash(row.plan.consultantName) },
    { key: "consultant2", label: t("Nhân sự tư vấn 2"), value: "—" },
  ];
  return { rows, moreRows };
}

/** The service table at 640px and below: one card per line, its position on the head. */
export function ServiceCardList({ rows, total, pagination, actions, showTotal }: Props) {
  return (
    <div className="tp-card-list pdt-card-list">
      {rows.length === 0 && <p className="bd-rc-empty">{t("Không có dữ liệu")}</p>}
      <div className="bd-rc-list">
        {rows.map((row) => {
          const card = cardRows(row, actions);
          return (
            <RecordCard
              key={row.service.id}
              title={String(row.index)}
              extra={
                <button
                  type="button"
                  className="bd-rc-action"
                  aria-label={t("Xem chi tiết")}
                  onClick={() => actions.onView(row)}
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
              }
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
