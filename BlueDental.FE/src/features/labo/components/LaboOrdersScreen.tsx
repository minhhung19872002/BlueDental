import { useState } from "react";
import { Button, Select } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  useLaboOrderList,
  LABO_SAMPLE_FILTER,
  LABO_STATUS_CONFIG,
  type LaboOrderDto,
  type LaboSampleFilter,
} from "../api/laboApi";
import { DataTable } from "@/components/DataTable";
import { PeriodPicker, periodRange, type Period } from "@/components/PeriodPicker";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { exportToExcel } from "@/utils/exportExcel";
import { formatDate, formatDateTime } from "@/utils/format";

/**
 * Mẫu Labo.
 *
 * The reference gives this screen no create button — a labo order is raised
 * from the patient's own screen — so there is none here either. What it has
 * and this does not yet: the second status dimension ("Tình trạng mẫu"), the
 * returned-files column and the detail modal. See docs/clone/pages/labo.md §2.
 */

/** The four filters the reference puts above the table, keyed as it keys them. */
type SampleTabKey = "all" | "chua-nhan" | "giao-tre" | "da-nhan";

const SAMPLE_FILTER_OF: Record<SampleTabKey, LaboSampleFilter> = {
  all: LABO_SAMPLE_FILTER.All,
  "chua-nhan": LABO_SAMPLE_FILTER.AwaitingReturn,
  "giao-tre": LABO_SAMPLE_FILTER.Overdue,
  "da-nhan": LABO_SAMPLE_FILTER.Returned,
};

function sampleTabs() {
  return [
    { key: "all" as const, label: t("Tất Cả Mẫu") },
    { key: "chua-nhan" as const, label: t("Mẫu Chưa Nhận") },
    { key: "giao-tre" as const, label: t("Mẫu Giao Trễ") },
    { key: "da-nhan" as const, label: t("Mẫu Đã Nhận Hàng") },
  ];
}

export function LaboOrdersScreen() {
  const [tab, setTab] = useState<SampleTabKey>("all");
  const [period, setPeriod] = useState<Period>({ mode: null, anchor: new Date() });
  const [patientId, setPatientId] = useState<string | undefined>();
  const [dentistId, setDentistId] = useState<string | undefined>();
  const [patientKeyword, setPatientKeyword] = useState("");

  const pagination = useTablePagination(20);
  const range = periodRange(period);

  const debouncedPatientKeyword = useDebounce(patientKeyword, 300);
  const patientOptions = usePatientOptions(debouncedPatientKeyword);
  const staffOptions = useStaffOptions();

  const query = useLaboOrderList({
    sampleFilter: SAMPLE_FILTER_OF[tab],
    patientId,
    dentistId,
    fromDate: range?.from,
    toDate: range?.to,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  /** Any change to the filters narrows the list, so the page starts over. */
  const refilter = (apply: () => void) => {
    apply();
    pagination.resetToFirstPage();
  };

  const handleExport = () => {
    // The reference exports the filtered list with its paired columns split
    // apart — see docs/clone/pages/labo.md §2.8.
    const rows = items.map((row) => ({
      supplier: row.supplierName ?? row.labProviderName,
      createdAt: formatDate(row.creationTime),
      patientName: row.patientName ?? "",
      sentDate: formatDateTime(row.sentAt ?? row.creationTime),
      deliveryDate: row.dueDate ? dayjs(row.dueDate).format("DD/MM/YYYY") : "",
      status: LABO_STATUS_CONFIG[row.status].label,
      dentistName: row.dentistName ?? "",
      materialName: row.materialName ?? "",
      teeth: row.toothNumbers ?? "",
    }));

    exportToExcel(
      rows,
      [
        { header: t("Nhà cung cấp"), key: "supplier" },
        { header: t("Ngày tạo"), key: "createdAt" },
        { header: t("Tên khách hàng"), key: "patientName" },
        { header: t("Ngày gửi"), key: "sentDate" },
        { header: t("Ngày giao"), key: "deliveryDate" },
        { header: t("Trạng thái Labo"), key: "status" },
        { header: t("Bác sĩ chỉ định"), key: "dentistName" },
        { header: t("Vật liệu"), key: "materialName" },
        { header: t("Răng"), key: "teeth" },
      ],
      "mau-labo",
    );
  };

  const columns: ColumnsType<LaboOrderDto> = [
    {
      key: "supplier",
      title: t("Nhà cung cấp / Ngày tạo"),
      width: 220,
      render: (_, row) => (
        <div className="bd-labo-stack">
          <p className="bd-cat-name">{row.supplierName ?? row.labProviderName}</p>
          <span className="bd-labo-sub">{formatDate(row.creationTime)}</span>
        </div>
      ),
    },
    {
      key: "patientName",
      title: t("Tên khách hàng"),
      width: 200,
      render: (_, row) => row.patientName ?? <span className="bd-cat-num">—</span>,
    },
    {
      key: "sentDate",
      title: t("Ngày gửi"),
      width: 180,
      // The reference pairs this with "Tình trạng mẫu"; the order has only one
      // status dimension so far, so the column carries the date alone.
      render: (_, row) => (
        <span className="bd-cat-num">{formatDateTime(row.sentAt ?? row.creationTime)}</span>
      ),
    },
    {
      key: "deliveryDate",
      title: t("Ngày giao / Trạng thái Labo"),
      width: 220,
      render: (_, row) => {
        const config = LABO_STATUS_CONFIG[row.status];
        return (
          <div className="bd-labo-stack">
            <span className="bd-cat-num">
              {row.dueDate ? dayjs(row.dueDate).format("DD/MM/YYYY") : "—"}
            </span>
            <StatusBadge label={config.label} bg={config.bg} color={config.color} />
          </div>
        );
      },
    },
    {
      key: "dentistName",
      title: t("Bác sĩ chỉ định"),
      width: 180,
      render: (_, row) => row.dentistName ?? <span className="bd-cat-num">—</span>,
    },
    {
      key: "materialName",
      title: t("Vật liệu"),
      width: 160,
      render: (_, row) => row.materialName ?? <span className="bd-cat-num">—</span>,
    },
    {
      key: "toothNumbers",
      title: t("Răng"),
      width: 120,
      render: (_, row) => row.toothNumbers ?? <span className="bd-cat-num">—</span>,
    },
  ];

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-header bd-labo-header--stacked">
        <div className="bd-labo-headrow">
          <PeriodPicker
            value={period}
            onChange={(next) => refilter(() => setPeriod(next))}
          />

          <Button
            icon={<DownloadOutlined />}
            disabled={items.length === 0}
            onClick={handleExport}
          >
            {t("Xuất Excel")}
          </Button>
        </div>

        <div className="bd-labo-headrow">
          <div className="bd-labo-headgroup">
            <SegmentedTabs
              items={sampleTabs()}
              activeKey={tab}
              onChange={(key) => refilter(() => setTab(key))}
            />

            <Select
              className="bd-labo-picker"
              showSearch
              allowClear
              filterOption={false}
              placeholder={t("Chọn khách hàng")}
              aria-label={t("Chọn khách hàng")}
              value={patientId}
              onSearch={setPatientKeyword}
              onChange={(value) => refilter(() => setPatientId(value))}
              options={(patientOptions.data ?? []).map((patient) => ({
                value: patient.id,
                label: `[${patient.code}] - ${patient.name}`,
              }))}
            />

            <Select
              className="bd-labo-picker"
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("Chọn bác sĩ")}
              aria-label={t("Chọn bác sĩ")}
              value={dentistId}
              onChange={(value) => refilter(() => setDentistId(value))}
              options={staffOptions.data ?? []}
            />
          </div>
        </div>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<LaboOrderDto>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={query.isFetching}
            locale={{ emptyText: t("Không có dữ liệu") }}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("mẫu labo")))}
          />
        </div>
      </div>
    </div>
  );
}
