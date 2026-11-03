import { useMemo } from "react";
import { Input, Select, Tooltip } from "antd";
import { Search, X } from "lucide-react";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import type { PatientImageType } from "../../../api/patientImageApi";
import { PATIENT_IMAGE_STAGES } from "./patientImageStages";

interface Props {
  /** What is typed in the note search, as typed. */
  search: string;
  onSearchChange: (search: string) => void;
  filter: PatientImageType | null;
  onFilterChange: (filter: PatientImageType) => void;
  onClearFilter: () => void;
}

/** Trước, Trong, Sau điều trị — the order the columns stand in. */
function useTypeOptions() {
  return useMemo(
    () => PATIENT_IMAGE_STAGES.map((stage) => ({ value: stage.type, label: t(stage.labelKey) })),
    [],
  );
}

/**
 * The white bar over the stage columns: the search by "Ghi chú", which every
 * column answers from the server; the stage filter, which narrows the tab to
 * one column; and an "Xóa lọc" cross that only appears once a stage is picked.
 * Uploading lives on each column's own header.
 */
export function PatientImageToolbar({ search, onSearchChange, filter, onFilterChange, onClearFilter }: Props) {
  const options = useTypeOptions();

  return (
    <section className="pi-toolbar" aria-label={t("Patient:Image:FilterLabel")}>
      <Input
        className="pi-search"
        value={search}
        allowClear
        prefix={<Search size={16} aria-hidden="true" />}
        placeholder={t("Patient:Image:SearchPlaceholder")}
        aria-label={t("Patient:Image:SearchLabel")}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <FloatingLabel label={t("Patient:Image:TreatmentPhase")} floated={filter !== null} className="pi-filter">
        <Select<PatientImageType>
          value={filter ?? undefined}
          options={options}
          onChange={onFilterChange}
          aria-label={t("Patient:Image:TreatmentPhase")}
          popupClassName="pi-filter-popup"
        />
      </FloatingLabel>

      {filter !== null && (
        <Tooltip title={t("Patient:Misc:ClearFilter")}>
          <button type="button" className="pi-clear" aria-label={t("Patient:Misc:ClearFilter")} onClick={onClearFilter}>
            <X size={16} />
          </button>
        </Tooltip>
      )}
    </section>
  );
}
