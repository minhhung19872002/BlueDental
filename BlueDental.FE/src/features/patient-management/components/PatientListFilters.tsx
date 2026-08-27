import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import type { PatientFilters } from "../hooks/usePatientListFilters";
import type { TreatmentTab } from "../types/patient";

export interface PatientFilterOptions {
  doctors: SearchSelectOption[];
  serviceGroups: SearchSelectOption[];
  tags: SearchSelectOption[];
}

interface Props {
  filters: PatientFilters;
  options: PatientFilterOptions;
  onChange: (next: Partial<PatientFilters>) => void;
  /** Stacks the three pickers under the tabs, for the Bộ lọc panel. */
  layout?: "row" | "stacked";
}

/** The four tabs, in the reference's order. */
export function treatmentTabs(): { key: TreatmentTab; label: string }[] {
  return [
    { key: "All", label: t("Tất cả") },
    { key: "Completed", label: t("Điều trị hoàn tất") },
    { key: "InTreatment", label: t("Đang điều trị") },
    { key: "Pending", label: t("Chưa phát sinh") },
  ];
}

/**
 * Trạng thái, Bác sĩ, Phân loại dịch vụ and Phân loại theo Tag.
 *
 * The reference leaves this row transparent — each control carries its own
 * border — and floats each picker's label onto that border once it has a value.
 */
export function PatientListFilters({ filters, options, onChange, layout = "row" }: Props) {
  return (
    <div className={layout === "row" ? "bd-patient-filters" : "bd-patient-filterpop-grid"}>
      {layout === "row" && (
        <SegmentedTabs
          items={treatmentTabs()}
          activeKey={filters.tab}
          onChange={(tab) => onChange({ tab })}
        />
      )}

      <FloatingLabel
        label={t("Bác sĩ")}
        floated={Boolean(filters.staffId)}
        className={layout === "row" ? "bd-patient-filter" : undefined}
      >
        <SearchSelect
          value={filters.staffId}
          options={options.doctors}
          placeholder={t("Chọn bác sĩ")}
          emptyText={t("Không tìm thấy bác sĩ")}
          allowClear
          onChange={(staffId) => onChange({ staffId })}
        />
      </FloatingLabel>

      <FloatingLabel
        label={t("Phân loại dịch vụ")}
        floated={Boolean(filters.serviceTaxonomyId)}
        className={layout === "row" ? "bd-patient-filter bd-patient-filter--wide" : undefined}
      >
        <SearchSelect
          value={filters.serviceTaxonomyId}
          options={options.serviceGroups}
          placeholder={t("Chọn dịch vụ")}
          emptyText={t("Không tìm thấy phân loại dịch vụ")}
          allowClear
          onChange={(serviceTaxonomyId) => onChange({ serviceTaxonomyId })}
        />
      </FloatingLabel>

      <FloatingLabel
        label={t("Phân loại theo Tag")}
        floated={Boolean(filters.tagId)}
        className={layout === "row" ? "bd-patient-filter bd-patient-filter--wide" : undefined}
      >
        <SearchSelect
          value={filters.tagId}
          options={options.tags}
          placeholder={t("Chọn tag")}
          emptyText={t("Không tìm thấy tag")}
          allowClear
          onChange={(tagId) => onChange({ tagId })}
        />
      </FloatingLabel>
    </div>
  );
}
