import { useMemo, useRef, type ChangeEvent } from "react";
import { Select, Tooltip } from "antd";
import { ImagePlus, X } from "lucide-react";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import { PATIENT_IMAGE_TYPE, type PatientImageType } from "../../../api/patientImageApi";

interface Props {
  filter: PatientImageType | null;
  uploading: boolean;
  canUpload: boolean;
  onFilterChange: (filter: PatientImageType) => void;
  onClearFilter: () => void;
  onUpload: (files: File[]) => void;
}

/** The two "Giai đoạn điều trị" values, hard-coded in the reference as well. */
function useTypeOptions() {
  return useMemo(
    () => [
      { value: PATIENT_IMAGE_TYPE.before, label: t("Trước điều trị") },
      { value: PATIENT_IMAGE_TYPE.after, label: t("Sau điều trị") },
    ],
    [],
  );
}

/**
 * The white bar over the timeline: the stage filter, an "Xóa lọc" cross that
 * only appears once a stage is picked, and "Tải ảnh", which goes straight to
 * the OS file chooser — no dialog in between.
 */
export function PatientImageToolbar({
  filter,
  uploading,
  canUpload,
  onFilterChange,
  onClearFilter,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useTypeOptions();

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onUpload(files);
  };

  return (
    <section className="pi-toolbar" aria-label={t("Bộ lọc hình ảnh")}>
      <FloatingLabel label={t("Giai đoạn điều trị")} floated={filter !== null} className="pi-filter">
        <Select<PatientImageType>
          value={filter ?? undefined}
          options={options}
          onChange={onFilterChange}
          aria-label={t("Giai đoạn điều trị")}
          popupClassName="pi-filter-popup"
        />
      </FloatingLabel>

      {filter !== null && (
        <Tooltip title={t("Xóa lọc")}>
          <button type="button" className="pi-clear" aria-label={t("Xóa lọc")} onClick={onClearFilter}>
            <X size={16} />
          </button>
        </Tooltip>
      )}

      {canUpload && (
        <>
          <button
            type="button"
            className="pi-upload"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={28} strokeWidth={1.5} />
            <span>{uploading ? t("Đang tải") : t("Tải ảnh")}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            data-testid="patient-image-input"
            onChange={handleFiles}
          />
        </>
      )}
    </section>
  );
}
