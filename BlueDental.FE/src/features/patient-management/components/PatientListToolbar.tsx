import { Button, Input } from "antd";
import { DownloadOutlined, IdcardOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { PeriodPicker, type Period } from "@/components/PeriodPicker";
import { t } from "@/lib/i18n";

interface Props {
  keyword: string;
  period: Period;
  exporting: boolean;
  /** "Xuất file" is offered. */
  canExport: boolean;
  /** "Tạo hồ sơ" is offered. */
  canCreate: boolean;
  onKeywordChange: (value: string) => void;
  onPeriodChange: (next: Period) => void;
  onExport: () => void;
  onCreate: () => void;
  /** "Quét CCCD" — offered alongside "Tạo hồ sơ", since it ends in one. */
  onScanId: () => void;
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
  canExport,
  canCreate,
  onKeywordChange,
  onPeriodChange,
  onExport,
  onCreate,
  onScanId,
}: Props) {
  return (
    <div className="bd-patient-toolbar">
      <div className="bd-patient-toolbar-left">
        <PeriodPicker value={period} onChange={onPeriodChange} clearableMode />

        <Input
          className="bd-patient-search"
          type="search"
          prefix={<SearchOutlined />}
          placeholder={t("Patient:Misc:Search")}
          aria-label={t("Patient:List:SearchHint")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>

      <div className="bd-patient-toolbar-actions">
        {canExport && (
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={onExport}>
            {t("Patient:Export")}
          </Button>
        )}

        {canCreate && (
          <Button icon={<IdcardOutlined />} onClick={onScanId}>
            {t("Patient:ScanId:Button")}
          </Button>
        )}

        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t("Patient:Create")}
          </Button>
        )}
      </div>
    </div>
  );
}
