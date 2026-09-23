import { Pagination } from "antd";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { servicePills, moneyText, type PlanServiceRow } from "./planTypes";

interface Props {
  rows: PlanServiceRow[];
  total: number;
  /** Position of the first row on the page, for the card numbers. */
  offset: number;
  diagnosisByAdviseId: ReadonlyMap<string, string>;
  pagination: TablePagination;
}

const NO_DIAGNOSIS = "\u2014";

function serviceRows(
  { plan, service }: PlanServiceRow,
  diagnosisByAdviseId: ReadonlyMap<string, string>,
): { rows: RecordCardRow[]; moreRows: RecordCardRow[] } {
  const pills = servicePills();
  const pill = pills[service.status] ?? pills[1];
  const teeth = formatTeeth(service.teeth);
  return {
    rows: [
      {
        key: "service",
        label: t("Treatment:Service:Service"),
        value: (
          <>
            {teeth && <span className="tp-service-teeth">{teeth} </span>}
            {service.serviceName}
          </>
        ),
      },
      {
        key: "status",
        label: t("Common:Status"),
        value: (
          <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>
            {pill.label}
          </span>
        ),
      },
      {
        key: "amount",
        label: t("Treatment:Pricing:NetAmount"),
        value: <span className="tp-cell-money">{moneyText(service.effectiveAmount)}</span>,
      },
    ],
    moreRows: [
      {
        key: "diagnosis",
        label: t("Treatment:Diagnosis:Diagnosis"),
        value:
          service.diagnosisName ||
          (service.sourceAdviseId && diagnosisByAdviseId.get(service.sourceAdviseId)) ||
          NO_DIAGNOSIS,
      },
      {
        key: "dentist",
        label: t("Treatment:Common:Doctor"),
        value: service.dentistName || plan.dentistName || NO_DIAGNOSIS,
      },
      {
        key: "price",
        label: t("Treatment:Pricing:UnitPrice"),
        value: (
          <span className="tp-cell-money">
            {moneyText(Math.round(service.effectiveAmount / Math.max(service.quantity, 1)))}
          </span>
        ),
      },
    ],
  };
}

/** "Danh sách dịch vụ" at 640px and below: one numbered card per service line. */
export function PlanServiceCardList({ rows, total, offset, diagnosisByAdviseId, pagination }: Props) {
  return (
    <div className="tp-card-list">
      {rows.length === 0 && <p className="bd-rc-empty">{t("Treatment:Common:NoData")}</p>}
      <div className="bd-rc-list">
        {rows.map((row, index) => {
          const card = serviceRows(row, diagnosisByAdviseId);
          return (
            <RecordCard
              key={row.service.id}
              title={t("Treatment:Service:ServiceNumber", offset + index + 1)}
              rows={card.rows}
              moreRows={card.moreRows}
            />
          );
        })}
      </div>
      {total > 0 && (
        <Pagination className="tp-card-pager" {...pagination.buildConfig(total)} />
      )}
    </div>
  );
}
