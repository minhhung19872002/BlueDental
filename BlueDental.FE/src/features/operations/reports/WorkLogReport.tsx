import { useMemo, useState } from "react";
import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useWorkLog, type WorkLogAction, type WorkLogRow } from "../api/operationReportApi";
import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { usePeriodRange } from "./usePeriodRange";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatMoney } from "./formatMoney";
import { formatDateTime } from "@/utils/format";

/** The reference's own list, in its own order. */
const ACTION_LABELS: Record<WorkLogAction, string> = {
  1: "Chẩn đoán",
  2: "Tư vấn",
  3: "Điều trị",
  4: "Công đoạn",
  5: "Tái khám",
  6: "Thanh toán",
  7: "Hoàn tiền",
  8: "Hủy dịch vụ",
  9: "Chuyển đổi dịch vụ",
  10: "Lịch hẹn",
  11: "Tiếp nhận",
};

const ACTION_ORDER: WorkLogAction[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Quản trị vận hành → Báo cáo.
 *
 * One line per thing that happened to a patient in the window, whichever table
 * it came from, filtered by what kind of thing it was.
 */
export function WorkLogReport() {
  const range = usePeriodRange("month");
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [actions, setActions] = useState<WorkLogAction[]>([]);

  const debounced = useDebounce(keyword, 300);

  const query = useWorkLog(
    {
      periodCode: range.periodCode,
      anchorIso: range.anchorIso,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
      filter: debounced.trim() || undefined,
    },
    { Actions: actions },
  );

  const columns = useMemo<ColumnsType<WorkLogRow>>(
    () => [
      {
        key: "when",
        title: t("Ngày / Khách hàng"),
        width: 260,
        render: (_, row) => (
          <span className="bd-ops-patient">
            <span className="bd-cat-num">{formatDateTime(row.occurredAt)}</span>
            <span className="bd-ops-patient-name">
              [{row.patientCode}] - {row.patientName}
            </span>
          </span>
        ),
      },
      { key: "staff", title: t("Nhân sự"), dataIndex: "staffName", width: 170 },
      {
        key: "action",
        title: t("Hành động"),
        width: 160,
        render: (_, row) => <span className="bd-ops-tag">{t(ACTION_LABELS[row.action])}</span>,
      },
      {
        key: "subject",
        title: t("Điều trị / Dịch vụ / Lịch hẹn"),
        render: (_, row) => row.subject || "—",
      },
      {
        key: "note",
        title: t("Nội dung / Ghi chú"),
        render: (_, row) => row.note ?? "—",
      },
      {
        key: "amount",
        title: t("Doanh số"),
        width: 150,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">{row.amount === 0 ? "—" : formatMoney(row.amount)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      <div className="bd-ops-report-filters">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm kiếm")}
          aria-label={t("Tìm kiếm")}
          value={keyword}
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            pagination.resetToFirstPage();
          }}
        />

        <Select<WorkLogAction[]>
          className="bd-ops-filter"
          mode="multiple"
          allowClear
          maxTagCount="responsive"
          placeholder={t("Hành động")}
          aria-label={t("Hành động")}
          value={actions}
          onChange={(value) => {
            setActions(value);
            pagination.resetToFirstPage();
          }}
          options={ACTION_ORDER.map((key) => ({ value: key, label: t(ACTION_LABELS[key]) }))}
        />
      </div>

      <div className="bd-cat-card">
        <DataTable<WorkLogRow>
          columns={columns}
          dataSource={query.data?.items ?? []}
          rowKey={(row) => `${row.occurredAt}-${row.action}-${row.patientCode}-${row.subject}`}
          loading={query.isFetching}
          pagination={pagination.buildConfig(
            query.data?.totalCount ?? 0,
            (total, rangeOf) =>
              total === 0
                ? t("Hiển thị 0 trên 0 công việc")
                : t("Hiển thị {0}–{1} trên {2} công việc", rangeOf[0], rangeOf[1], total),
          )}
          locale={{ emptyText: t("Không có dữ liệu") }}
        />
      </div>
    </div>
  );
}
