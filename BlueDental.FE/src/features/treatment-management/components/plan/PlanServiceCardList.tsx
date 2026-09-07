import { Pagination } from "antd";
import { RecordCard, type RecordCardRow } from "@/components/RecordCard";
import type { TablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { SERVICE_PILL, moneyText, type PlanServiceRow } from "./planTypes";

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
  const pill = SERVICE_PILL[service.status] ?? SERVICE_PILL[1];
  const teeth = formatTeeth(service.teeth);
  return {
    rows: [
      {
        key: "service",
        label: t("Dịch vụ"),
        value: (
          <>
            {teeth && <span className="tp-service-teeth">{teeth} </span>}
            {service.serviceName}
          </>
        ),
      },
      {
        key: "status",
        label: t("Trạng thái"),
        value: (
          <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>
            {t(pill.label)}
          </span>
        ),
      },
      {
        key: "amount",
        label: t("Thành tiền"),
        value: <span className="tp-cell-money">{moneyText(service.effectiveAmount)}</span>,
      },
    ],
    moreRows: [
      {
        key: "diagnosis",
        label: t("Chẩn đoán"),
        value:
          (service.sourceAdviseId && diagnosisByAdviseId.get(service.sourceAdviseId)) ||
          NO_DIAGNOSIS,
      },
      { key: "dentist", label: t("Bác sĩ"), value: plan.dentistName },
      {
        key: "price",
        label: t("Đơn giá"),
        value: <span className="tp-cell-money">{moneyText(service.price)}</span>,
      },
    ],
  };
}

/** "Danh sách dịch vụ" at 640px and below: one numbered card per service line. */
export function PlanServiceCardList({ rows, total, offset, diagnosisByAdviseId, pagination }: Props) {
  return (
    <div className="tp-card-list">
      {rows.length === 0 && <p className="bd-rc-empty">{t("Chưa có dịch vụ")}</p>}
      <div className="bd-rc-list">
        {rows.map((row, index) => {
          const card = serviceRows(row, diagnosisByAdviseId);
          return (
            <RecordCard
              key={row.service.id}
              title={t("Dịch vụ {0}", offset + index + 1)}
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
