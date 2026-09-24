import { Pagination } from "antd";
import { Eye } from "lucide-react";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatToothCodes } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { DiscountCell, ServiceNameCell, type ServiceRowActions } from "./serviceColumns";
import { advanceOn, dash, type PlanDetailRow } from "./planDetailTypes";

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
    { key: "service", label: t("Treatment:Service:Service"), value: <ServiceNameCell row={row} actions={actions} /> },
    { key: "diagnosis", label: t("Treatment:Diagnosis:Diagnosis"), value: dash(row.advise?.diagnosisName) },
    { key: "dentist", label: t("Treatment:Common:DentistDoctor"), value: dash(row.plan.dentistName) },
    { key: "teeth", label: t("Treatment:Tooth:Tooth"), value: formatToothCodes(row.service.teeth) || "—" },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "quantity", label: t("Treatment:Pricing:Quantity"), value: row.service.quantity },
    { key: "price", label: t("Treatment:Pricing:UnitPrice"), value: moneyText(row.service.price) },
    { key: "discount", label: t("Treatment:Pricing:TotalDiscount"), value: <DiscountCell row={row} /> },
    { key: "amount", label: t("Treatment:Pricing:NetAmount"), value: <strong>{moneyText(row.service.effectiveAmount)}</strong> },
    { key: "advance", label: t("Treatment:Payment:Prepaid"), value: moneyText(advanceOn(row.service)) },
    { key: "note", label: t("Treatment:Service:Note"), value: dash(row.advise?.note) },
    { key: "diagnoser1", label: t("Treatment:Diagnosis:DoctorOne"), value: dash(row.advise?.staffName) },
    { key: "diagnoser2", label: t("Treatment:Diagnosis:DiagnosisTwo"), value: dash(row.advise?.secondStaffName) },
    { key: "consultant1", label: t("Treatment:Consulting:ConsultantOne"), value: dash(row.plan.consultantName) },
    { key: "consultant2", label: t("Treatment:Consulting:ConsultantTwo"), value: "—" },
  ];
  return { rows, moreRows };
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
              extra={
                <button
                  type="button"
                  className="bd-rc-action"
                  aria-label={t("Treatment:Service:ViewDetail")}
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
