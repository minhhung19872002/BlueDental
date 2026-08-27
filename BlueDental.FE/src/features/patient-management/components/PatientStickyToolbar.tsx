import { Button } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { PeriodPicker, type Period } from "@/components/PeriodPicker";
import { t } from "@/lib/i18n";
import { PatientFilterPopover } from "./PatientFilterPopover";
import type { PatientFilterOptions } from "./PatientListFilters";
import type { PatientFilters } from "../hooks/usePatientListFilters";

interface Props {
  visible: boolean;
  period: Period;
  filters: PatientFilters;
  options: PatientFilterOptions;
  exporting: boolean;
  onPeriodChange: (next: Period) => void;
  onApplyFilters: (next: PatientFilters) => void;
  onClearFilters: () => void;
  onExport: () => void;
  onCreate: () => void;
}

/**
 * The compact toolbar the reference slides in once the real one has scrolled
 * away: the period control, then "Bộ lọc", "Xuất file" and "Tạo hồ sơ".
 *
 * The search box and the three pickers do not fit here, so they move behind
 * "Bộ lọc" — which is the only place that panel is reachable.
 */
export function PatientStickyToolbar({
  visible,
  period,
  filters,
  options,
  exporting,
  onPeriodChange,
  onApplyFilters,
  onClearFilters,
  onExport,
  onCreate,
}: Props) {
  // Nothing is rendered until it slides in: while the real toolbar is on screen
  // these would be a second "Xuất file" and a second "Tạo hồ sơ" with the same
  // names, which is confusing to a screen reader and ambiguous to a test.
  if (!visible) {
    return <div className="bd-patient-sticky" aria-hidden="true" />;
  }

  return (
    <div className="bd-patient-sticky bd-patient-sticky--in">
      <PeriodPicker value={period} onChange={onPeriodChange} clearableMode />

      <div className="bd-patient-toolbar-actions">
        <PatientFilterPopover
          filters={filters}
          options={options}
          onApply={onApplyFilters}
          onClear={onClearFilters}
        />

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
