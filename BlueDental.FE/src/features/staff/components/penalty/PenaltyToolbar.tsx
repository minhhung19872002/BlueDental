import { Button, DatePicker, Input } from "antd";
import { PlusOutlined, SearchOutlined, TagsOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { DateRange } from "../../hooks/usePenaltyFilters";
import { statusFilterTabs, type StatusFilterKey } from "./penaltyConfig";

interface Props {
  keyword: string;
  onKeywordChange: (value: string) => void;
  range: DateRange;
  onRangeChange: (value: DateRange) => void;
  status: StatusFilterKey;
  onStatusChange: (value: StatusFilterKey) => void;
  approvedFineTotal: number;
  /** Absent when the account may not do it. */
  onCreate?: () => void;
  onManageTypes: () => void;
}

/** Search, date range and the two buttons; below them the status pills and the approved total. */
export function PenaltyToolbar(props: Props) {
  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="staff-penalty-toolbar">
          <Input
            className="staff-penalty-toolbar__search"
            prefix={<SearchOutlined />}
            placeholder={t("StaffPenalty:SearchPlaceholder")}
            aria-label={t("StaffPenalty:SearchPlaceholder")}
            value={props.keyword}
            maxLength={100}
            allowClear
            onChange={(e) => props.onKeywordChange(e.target.value)}
          />
          <DatePicker.RangePicker
            className="staff-penalty-toolbar__range"
            format="DD/MM/YYYY"
            aria-label={t("StaffPenalty:DateRange")}
            value={props.range}
            onChange={(value) => props.onRangeChange(value)}
          />
          <Button icon={<TagsOutlined />} onClick={props.onManageTypes}>
            {t("StaffPenalty:ManageTypes")}
          </Button>
          {props.onCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={props.onCreate}>
              {t("StaffPenalty:Create")}
            </Button>
          )}
        </div>
      </div>

      <div className="reception-card reception-card--tabs">
        <div className="staff-penalty-filters">
          <div className="staff-penalty-filters__pills">
            {statusFilterTabs().map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`reception-status-pill ${props.status === tab.key ? "reception-status-pill--active" : ""}`}
                onClick={() => props.onStatusChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="staff-penalty-total">
            {t("StaffPenalty:ApprovedTotal")} <strong>{formatVND(props.approvedFineTotal)} đ</strong>
          </span>
        </div>
      </div>
    </>
  );
}
