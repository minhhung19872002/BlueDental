import type { TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import { LABO_ROUND_OUTCOME, type LaboOrderRoundDto } from "@/features/labo/api/laboApi";
import { LABO_ROUND_OUTCOME_PILL, roundDefects } from "./laboCheckRules";

const dateOrDash = (value: string | null | undefined) => formatDateTime(value) || "—";

const RETURNED = new Set<number>([LABO_ROUND_OUTCOME.ReturnedAll, LABO_ROUND_OUTCOME.ReturnedDefective]);

function buildColumns(): TableColumnsType<LaboOrderRoundDto> {
  return [
    { title: t("Labo:Check:History:Round"), dataIndex: "roundNo", width: 64, align: "center" },
    {
      title: t("Labo:Check:History:ReceivedAt"),
      dataIndex: "receivedAt",
      width: 140,
      render: (value: string, row) => (
        <>
          {dateOrDash(value)}
          <div className="pd-labo-history-sub">
            {t("Labo:Check:History:Pieces", row.receivedQuantity)}
            {row.receiverName ? ` · ${row.receiverName}` : ""}
          </div>
        </>
      ),
    },
    {
      title: t("Labo:Check:History:Outcome"),
      dataIndex: "outcome",
      width: 130,
      render: (value: LaboOrderRoundDto["outcome"]) => {
        const pill = LABO_ROUND_OUTCOME_PILL[value];
        return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
      },
    },
    {
      title: t("Labo:Check:History:Defects"),
      key: "defects",
      width: 220,
      render: (_, row) => roundDefects(row) || "—",
    },
    {
      title: t("Labo:Check:History:ReturnedAt"),
      dataIndex: "returnedAt",
      width: 140,
      render: (value: string | null | undefined) => dateOrDash(value),
    },
    {
      title: t("Labo:Check:History:RedeliveryDueAt"),
      dataIndex: "redeliveryDueAt",
      width: 140,
      render: (value: string | null | undefined) => dateOrDash(value),
    },
  ];
}

/** Lịch sử nhận hàng & trả hàng: one row per delivery, newest last as the rounds ran. */
export function LaboRoundHistoryTable({ rounds }: { rounds: LaboOrderRoundDto[] }) {
  const returns = rounds.filter((round) => RETURNED.has(round.outcome)).length;
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <h3>{t("Labo:Check:History:Title")}</h3>
        <span className="pd-labo-check-aside">{t("Labo:Check:History:Count", rounds.length, returns)}</span>
      </header>
      <DataTable<LaboOrderRoundDto>
        rowKey="roundNo"
        size="small"
        columns={buildColumns()}
        dataSource={rounds}
        pagination={false}
        locale={{ emptyText: t("Labo:Check:History:Empty") }}
      />
    </section>
  );
}
