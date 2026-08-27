import { Button, Input } from "antd";
import { DownloadOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { PeriodPicker, type Period } from "@/components/PeriodPicker";
import { t } from "@/lib/i18n";

interface Props {
  keyword: string;
  period: Period;
  exporting: boolean;
  onKeywordChange: (value: string) => void;
  onPeriodChange: (next: Period) => void;
  onExport: () => void;
  onCreate: () => void;
}

/**
 * The row above the patient list: Ngày / Tuần / Tháng with the window they
 * read, the search box, then "Xuất file" and "Tạo hồ sơ".
 *
 * Presentational — it holds no state and knows nothing about the API.
 */
export function PatientListToolbar({
  keyword,
  period,
  exporting,
  onKeywordChange,
  onPeriodChange,
  onExport,
  onCreate,
}: Props) {
  return (
    <div className="bd-patient-toolbar">
      <div className="bd-patient-toolbar-left">
        <PeriodPicker value={period} onChange={onPeriodChange} clearableMode />

        <Input
          className="bd-patient-search"
          type="search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm kiếm")}
          aria-label={t("Tìm theo tên, mã khách hàng, số điện thoại")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>

      <div className="bd-patient-toolbar-actions">
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>
          {t("Xuất file")}
        </Button>

        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("Tạo hồ sơ")}
        </Button>
      </div>
    </div>
  );
}
