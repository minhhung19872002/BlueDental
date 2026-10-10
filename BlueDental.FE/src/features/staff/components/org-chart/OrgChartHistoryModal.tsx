import { useState } from "react";
import { DatePicker, Input, Modal, Select, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import {
  ORG_CHART_ACTIONS,
  useOrgChartHistory,
  type OrgChartAction,
  type OrgUnitChangeLogDto,
} from "../../api/orgChartApi";
import { OrgHistoryDiff } from "./OrgHistoryDiff";
import { ORG_ACTION_CONFIG, orgHistoryColumns } from "./orgHistoryColumns";

type DateRange = [Dayjs | null, Dayjs | null] | null;

/** Mounted only while the dialog is open, so the log is fetched on demand. */
function OrgChartHistoryBody() {
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState<OrgChartAction | undefined>();
  const [range, setRange] = useState<DateRange>(null);
  const filter = useDebounce(keyword.trim(), 300);
  const pagination = useTablePagination(20);

  const { data, isFetching } = useOrgChartHistory(
    {
      filter: filter || undefined,
      action,
      fromDate: range?.[0]?.format("YYYY-MM-DD"),
      toDate: range?.[1]?.format("YYYY-MM-DD"),
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    true,
  );

  const withReset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      pagination.resetToFirstPage();
    };

  return (
    <div className="org-history">
      <div className="org-history__filters">
        <Input
          className="org-history__search"
          prefix={<SearchOutlined />}
          placeholder={t("OrgChart:History:Search")}
          aria-label={t("OrgChart:History:Search")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(e) => withReset(setKeyword)(e.target.value)}
        />
        <Select<OrgChartAction>
          className="org-history__action"
          allowClear
          placeholder={t("OrgChart:History:AllActions")}
          aria-label={t("OrgChart:History:Action")}
          value={action}
          options={ORG_CHART_ACTIONS.map((a) => ({ value: a, label: t(ORG_ACTION_CONFIG[a].labelKey) }))}
          onChange={withReset(setAction)}
        />
        <DatePicker.RangePicker
          className="org-history__range"
          format="DD/MM/YYYY"
          aria-label={t("OrgChart:History:Range")}
          value={range}
          onChange={withReset(setRange)}
        />
      </div>
      <Table<OrgUnitChangeLogDto>
        className="org-history__table"
        rowKey="id"
        size="middle"
        columns={orgHistoryColumns()}
        dataSource={data?.items ?? []}
        loading={isFetching}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("OrgChart:History:Empty") }}
        expandable={{ expandedRowRender: (row) => <OrgHistoryDiff changes={row.changes} /> }}
        pagination={pagination.buildConfig(data?.totalCount)}
      />
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Lịch sử thay đổi" of the chart: who created, edited, deleted or re-staffed which unit. */
export function OrgChartHistoryModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={1080}
      className="app-dialog org-history-modal"
      title={
        <div className="bd-modal-head">
          <div>
            <h2 className="bd-modal-title">{t("OrgChart:History:Title")}</h2>
            <p className="bd-modal-subtitle">{t("OrgChart:History:Subtitle")}</p>
          </div>
        </div>
      }
    >
      {open && <OrgChartHistoryBody />}
    </Modal>
  );
}
