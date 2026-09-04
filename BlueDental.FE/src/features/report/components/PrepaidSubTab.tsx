import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { useMockPrepaidLines, useMockSalesSummary, type RangeQuery } from "../api/reportMockQueries";
import { useClientPaging } from "../hooks/useClientPaging";
import type { PrepaidEventType, PrepaidLineVm } from "../types/mock";
import { ReportStatCards, type StatCardItem, type StatTone } from "./ReportStatCards";
import { ReportStatsBar } from "./ReportStatsBar";
import { ReportTableCard } from "./ReportTableCard";

const EVENT_CONFIG: Record<PrepaidEventType, { label: () => string; tone: StatTone }> = {
  deposit: { label: () => t("Tạm ứng phát sinh"), tone: "green" },
  consume: { label: () => t("Tiêu dùng tạm ứng"), tone: "gold" },
  refund: { label: () => t("Hoàn tiền tạm ứng"), tone: "blue" },
};

function renderAmount(value: number, row: PrepaidLineVm) {
  const sign = value < 0 ? "-" : "+";
  return (
    <span className={`report-money report-money--${EVENT_CONFIG[row.eventType].tone}`}>
      {sign}
      {formatVND(Math.abs(value))} đ
    </span>
  );
}

function buildColumns(): TableColumnsType<PrepaidLineVm> {
  return [
    { title: t("Ngày"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
    {
      title: t("Khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
    },
    {
      title: t("Loại sự kiện"),
      dataIndex: "eventType",
      width: 160,
      render: (v: PrepaidEventType) => EVENT_CONFIG[v].label(),
    },
    { title: t("Dịch vụ"), dataIndex: "serviceName" },
    { title: t("Phiếu thanh toán"), dataIndex: "paymentCode", width: 210 },
    { title: t("Bác sĩ điều trị"), dataIndex: "doctorName", width: 170 },
    { title: t("Số tiền"), dataIndex: "amount", width: 140, align: "right", render: renderAmount },
    {
      title: t("Số dư sau"),
      dataIndex: "balanceAfter",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money">{formatVND(v)} đ</span>,
    },
  ];
}

/** Sub-tab "Tạm ứng": 4 tiles + green "Tạm ứng" pill (no export), then the prepaid ledger table. */
export function PrepaidSubTab(range: RangeQuery) {
  const { data: lines = [], isLoading } = useMockPrepaidLines(range);
  const { data: summary, isLoading: summaryLoading } = useMockSalesSummary(range);
  const paging = useClientPaging(lines);
  const columns = useMemo(buildColumns, []);

  const cards: StatCardItem[] = [
    { label: t("Tạm ứng phát sinh"), value: summary?.prepaidIncurred ?? 0, tone: "green" },
    { label: t("Tiêu dùng tạm ứng"), value: summary?.prepaidConsumed ?? 0, tone: "gold" },
    { label: t("Hoàn tiền tạm ứng"), value: summary?.prepaidRefund ?? 0, tone: "blue" },
    { label: t("Số dư tạm ứng hiện tại"), value: summary?.prepaidBalance ?? 0, tone: "ink" },
  ];

  return (
    <>
      <div className="report-headline-row">
        <ReportStatCards variant="compact" items={cards} />
        <ReportStatsBar
          label={t("Tạm ứng")}
          value={Math.max(summary?.prepaidBalance ?? 0, 0)}
          tone="green"
          loading={summaryLoading}
        />
      </div>
      <ReportTableCard<PrepaidLineVm>
        rowKey="id"
        columns={columns}
        dataSource={paging.pageRows}
        loading={isLoading}
        totalCount={paging.totalCount}
        page={paging.page}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
      />
    </>
  );
}
