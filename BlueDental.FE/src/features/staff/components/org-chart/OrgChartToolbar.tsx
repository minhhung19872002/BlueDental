import { Button, Input } from "antd";
import { HistoryOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onHistory: () => void;
  /** Absent when the account may not add units. */
  onCreate?: () => void;
}

/** Search over the chart, "Lịch sử thay đổi" and "+ Thêm đơn vị". */
export function OrgChartToolbar({ keyword, onKeywordChange, onHistory, onCreate }: Props) {
  return (
    <div className="reception-card reception-card--toolbar">
      <div className="org-toolbar">
        <Input
          className="org-toolbar__search"
          prefix={<SearchOutlined />}
          placeholder={t("OrgChart:Search:Placeholder")}
          aria-label={t("OrgChart:Search:Placeholder")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(e) => onKeywordChange(e.target.value)}
        />
        <div className="org-toolbar__actions">
          <Button icon={<HistoryOutlined />} onClick={onHistory}>
            {t("OrgChart:History:Open")}
          </Button>
          {onCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              {t("OrgChart:Action:Create")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
