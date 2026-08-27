import { useMemo, useState } from "react";
import { Button, Input, Select } from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  RiseOutlined,
  SearchOutlined,
  StarOutlined,
  SyncOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  SALES_CATEGORY,
  useServiceCompletion,
  type ServiceLineRow,
} from "../api/operationReportApi";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { OperationsStatCards, type StatCard } from "./OperationsStatCards";
import { serviceCompletionColumns, serviceLineSpanKeys } from "./serviceLineColumns";
import { rowSpansBy } from "./rowSpans";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceGroupOptions } from "@/hooks/useServiceGroupOptions";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { exportToExcel } from "@/utils/exportExcel";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";
import { formatDate } from "@/utils/format";

/**
 * Khối tài chính → Hoàn thành theo dịch vụ.
 *
 * The service lines of the window with five figures above them, one of which
 * says which way the clinic is moving against the period before.
 */
export function ServiceCompletionReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [dentistId, setDentistId] = useState<string | undefined>();
  const [serviceGroupId, setServiceGroupId] = useState<string | undefined>();

  const debounced = useDebounce(keyword, 300);
  const dentists = useStaffOptions();
  const serviceGroups = useServiceGroupOptions();

  const query = useServiceCompletion(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
      filter: debounced.trim() || undefined,
    },
    { DentistId: dentistId, ServiceGroupId: serviceGroupId },
  );

  const stats = query.data?.stats;

  const cards = useMemo<StatCard[]>(() => {
    const change = stats?.revenueChangePercent;

    return [
      {
        key: "collected",
        value: formatMoney(stats?.actualCollected ?? 0),
        label: t("Thực thu"),
        icon: <WalletOutlined />,
        tone: "teal",
      },
      {
        key: "revenue",
        value: formatMoney(stats?.totalRevenue ?? 0),
        label: t("Tổng doanh thu"),
        icon: <RiseOutlined />,
        tone: "blue",
        badge:
          change === null || change === undefined
            ? undefined
            : {
                text: t("{0}% so với kỳ trước", `${change > 0 ? "+" : ""}${change}`),
                tone: change < 0 ? "rose" : "green",
              },
      },
      {
        key: "advance",
        value: formatMoney(stats?.advanceRevenue ?? 0),
        label: t("Doanh thu từ KH tạm ứng"),
        icon: <DollarOutlined />,
        tone: "amber",
      },
      {
        key: "completed",
        value: formatMoney(stats?.completedServices ?? 0),
        label: t("Dịch vụ hoàn thành"),
        icon: <CheckCircleOutlined />,
        tone: "green",
        badge: {
          text: t("{0}% đúng tiến độ", stats?.onScheduePercent ?? 0),
          tone: "green",
        },
      },
      {
        key: "ownQuota",
        value: formatMoney(stats?.ownQuotaServices ?? 0),
        label: t("Dịch vụ doanh số riêng"),
        icon: <StarOutlined />,
        tone: "rose",
        badge: { text: t("Tính theo định mức riêng"), tone: "rose" },
      },
    ];
  }, [stats]);

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  // Grouped by day, then by patient within the day, as the reference groups it.
  const columns = useMemo(() => {
    const [date, patient] = rowSpansBy(rows, serviceLineSpanKeys());
    const positions = new Map(rows.map((row, index) => [row, index] as const));

    return serviceCompletionColumns({
      indexOf: (row) => positions.get(row) ?? 0,
      date,
      patient,
    });
  }, [rows]);

  /**
   * The rows on screen, as a spreadsheet.
   *
   * Named field by field rather than through the table's own columns: every one
   * of them is rendered, so none carries a `dataIndex` for a generic export to
   * read.
   */
  const exportRows = () => {
    exportToExcel<ServiceLineRow>(
      query.data?.items ?? [],
      [
        { header: t("Ngày thao tác"), key: "occurredAt", format: (v) => formatDate(String(v)) },
        { header: t("Mã khách hàng"), key: "patientCode" },
        { header: t("Khách hàng"), key: "patientName" },
        { header: t("Chi nhánh"), key: "branchName" },
        { header: t("Dịch vụ"), key: "serviceName" },
        { header: t("Nhóm dịch vụ"), key: "serviceGroupName" },
        {
          header: t("Phân loại"),
          key: "classification",
          format: (v) =>
            v === SALES_CATEGORY.completed
              ? t("Dịch vụ đã hoàn thành")
              : t("Dịch vụ tính doanh số riêng"),
        },
        { header: t("Bác sĩ điều trị"), key: "treatingDentistName" },
        { header: t("Nhân sự tư vấn"), key: "consultantName" },
        { header: t("Răng"), key: "teeth" },
        { header: t("Giá dịch vụ"), key: "price" },
        { header: t("Số lượng"), key: "quantity" },
        { header: t("Tổng giảm giá"), key: "discountAmount" },
        { header: t("Giá điều trị bác sĩ"), key: "doctorAmount" },
      ],
      `hoan-thanh-theo-dich-vu-${range.anchorIso}`,
    );
  };

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      {/* Three filters on the left, the two actions on the right. */}
      <div className="bd-ops-report-head">
        <div className="bd-ops-report-filters">
          <Input
            className="bd-ops-search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm khách hàng, dịch vụ")}
            aria-label={t("Tìm khách hàng, dịch vụ")}
            value={keyword}
            allowClear
            onChange={(event) => {
              setKeyword(event.target.value);
              pagination.resetToFirstPage();
            }}
          />

          <Select
            className="bd-ops-filter"
            showSearch
            allowClear
            loading={dentists.isLoading}
            placeholder={t("Bác sĩ điều trị")}
            aria-label={t("Bác sĩ điều trị")}
            optionFilterProp="label"
            value={dentistId}
            onChange={(value) => {
              setDentistId(value ?? undefined);
              pagination.resetToFirstPage();
            }}
            options={dentists.data ?? []}
          />

          <Select
            className="bd-ops-filter"
            showSearch
            allowClear
            loading={serviceGroups.isLoading}
            placeholder={t("Nhóm dịch vụ")}
            aria-label={t("Nhóm dịch vụ")}
            optionFilterProp="label"
            value={serviceGroupId}
            onChange={(value) => {
              setServiceGroupId(value ?? undefined);
              pagination.resetToFirstPage();
            }}
            options={serviceGroups.data ?? []}
          />
        </div>

        <div className="bd-ops-report-actions">
          <Button
            icon={<SyncOutlined />}
            // The reference offers this; BlueDental has no sales system to sync
            // with, so it says so rather than pretending to do something.
            disabled
            title={t("Chưa kết nối phần mềm bán hàng")}
          >
            {t("Đồng bộ phần mềm bán hàng")}
          </Button>

          <Button icon={<DownloadOutlined />} onClick={exportRows}>
            {t("Xuất Excel")}
          </Button>
        </div>
      </div>

      <OperationsStatCards cards={cards} />

      <div className="bd-cat-card">
        <DataTable<ServiceLineRow>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={query.isFetching}
          scroll={{ x: 2800 }}
          pagination={pagination.buildConfig(
            query.data?.totalCount ?? 0,
            (total, rangeOf) =>
              total === 0
                ? t("Hiển thị 0 trên 0 dịch vụ")
                : t("Hiển thị {0}–{1} trên {2} dịch vụ", rangeOf[0], rangeOf[1], total),
          )}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
