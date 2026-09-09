import { Button, Select } from "antd";
import { Minus, Plus } from "lucide-react";
import { FloatingLabel } from "@/components/FloatingLabel";
import type { MedicalRecordForm } from "@/features/patient-management/api/medicalRecordApi";
import { t } from "@/lib/i18n";
import { PREVIEW_ZOOM, PRINT_FORM_OPTIONS } from "./printRecordPreview";

interface Props {
  form: MedicalRecordForm;
  onFormChange: (form: MedicalRecordForm) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * The row above the preview: which file is being printed on the left, the
 * reference's note about the yellow cells and the zoom control on the right.
 */
export function PrintRecordToolbar({ form, onFormChange, zoom, onZoomChange }: Props) {
  return (
    <div className="pmr-toolbar">
      <FloatingLabel label={t("Chọn file bệnh án")} floated className="pmr-file">
        <Select<MedicalRecordForm>
          value={form}
          onChange={onFormChange}
          options={PRINT_FORM_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.label),
          }))}
          showSearch
          optionFilterProp="label"
        />
      </FloatingLabel>

      <div className="pmr-tools">
        <span className="pmr-hint">
          {t("Thông tin bệnh nhân được điền từ API; ô nền vàng vẫn có thể chỉnh trước khi in")}
        </span>
        <div className="pmr-zoom">
          <Button
            className="pmr-zoom-btn"
            aria-label={t("Thu nhỏ bản xem trước")}
            icon={<Minus size={14} aria-hidden="true" />}
            disabled={zoom <= PREVIEW_ZOOM.min}
            onClick={() => onZoomChange(zoom - PREVIEW_ZOOM.step)}
          />
          <span className="pmr-zoom-value">{Math.round(zoom * 100)}%</span>
          <Button type="link" className="pmr-zoom-fit" onClick={() => onZoomChange(PREVIEW_ZOOM.fit)}>
            {t("Fit")}
          </Button>
          <Button
            className="pmr-zoom-btn"
            aria-label={t("Phóng to bản xem trước")}
            icon={<Plus size={14} aria-hidden="true" />}
            disabled={zoom >= PREVIEW_ZOOM.max}
            onClick={() => onZoomChange(zoom + PREVIEW_ZOOM.step)}
          />
        </div>
      </div>
    </div>
  );
}
