import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { LABO_TOOTH_RESULT, type LaboOrderDto, type LaboToothResult } from "@/features/labo/api/laboApi";
import { historyAside, toothHistoryRows, type LaboLiveCheck, type LaboToothHistoryRow } from "./laboCheckHistory";
import type { LaboTone } from "./laboCheckRules";

const RESULT_PILL: Partial<Record<LaboToothResult, { label: string; tone: LaboTone }>> = {
  [LABO_TOOTH_RESULT.Passed]: { label: "Labo:Check:Pass", tone: "pass" },
  [LABO_TOOTH_RESULT.Failed]: { label: "Labo:Check:Fail", tone: "fail" },
};

const toned = (tone: LaboTone) => `pd-labo-tone pd-labo-tone--${tone}`;

function buildColumns(): TableColumnsType<LaboToothHistoryRow> {
  return [
    {
      title: t("Labo:Check:History:RoundDate"),
      key: "round",
      width: 150,
      onCell: (row) => ({ rowSpan: row.span }),
      render: (_, row) => (
        <>
          <b>{t("Labo:Check:History:RoundOn", row.roundNo, dayjs(row.receivedAt).format("DD/MM"))}</b>
          <div className={`pd-labo-history-sub ${toned(row.roundTally.tone)}`}>{row.roundTally.label}</div>
        </>
      ),
    },
    {
      title: t("Labo:Check:History:Tooth"),
      dataIndex: "tooth",
      width: 72,
      render: (tooth: number) => t("Labo:Check:History:ToothNo", tooth),
    },
    {
      title: t("Labo:Check:History:Result"),
      dataIndex: "result",
      width: 96,
      render: (result: LaboToothResult) => {
        const pill = RESULT_PILL[result];
        return pill ? <span className={`pd-labo-result-pill ${toned(pill.tone)}`}>{t(pill.label)}</span> : "—";
      },
    },
    {
      title: t("Labo:Check:History:Defects"),
      dataIndex: "note",
      render: (note: string | null | undefined) => note || "—",
    },
    {
      title: t("Labo:Check:History:Action"),
      key: "action",
      width: 110,
      render: (_, row) => <span className={toned(row.action.tone)}>{row.action.label}</span>,
    },
    {
      title: t("Labo:Check:History:RedeliveryDueAt"),
      dataIndex: "redeliveryDueAt",
      width: 140,
      render: (value: string | null | undefined) => formatDate(value) || "—",
    },
  ];
}

interface Props {
  order: LaboOrderDto;
  /** The check on screen, shown as the open round's "đang nhập" rows. */
  live: LaboLiveCheck | null;
}

/** Lịch sử nhận hàng & trả hàng · theo răng (P3110 m189, m294): a row per tooth per delivery. */
export function LaboRoundHistoryTable({ order, live }: Props) {
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <h3>{t("Labo:Check:History:Title")}</h3>
        <span className="pd-labo-check-aside">{historyAside(order, live)}</span>
      </header>
      <DataTable<LaboToothHistoryRow>
        rowKey="key"
        size="small"
        columns={buildColumns()}
        dataSource={toothHistoryRows(order, live)}
        pagination={false}
        rowClassName={(row) => (row.live ? "pd-labo-history-live" : "")}
        locale={{ emptyText: t("Labo:Check:History:Empty") }}
      />
    </section>
  );
}
