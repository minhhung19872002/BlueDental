import { Button, Input, Select } from "antd";
import { PictureOutlined, SaveOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";

/** The reference caps Nội dung điều trị at 1000 characters. */
export const NOTE_LIMIT = 1000;

export interface StaffOption {
  value: string;
  label: string;
}

interface Props {
  line: TreatmentServiceDto;
  options: StaffOption[];
  staffId: string | undefined;
  subStaffId: string | undefined;
  secondStaffId: string | undefined;
  note: string;
  /** Pictures chosen before the công đoạn exists; attached once it is saved. */
  pending: File[];
  saving: boolean;
  primaryLabel: string;
  onStaff: (value: string) => void;
  onSubStaff: (value: string | undefined) => void;
  onSecondStaff: (value: string | undefined) => void;
  onNote: (value: string) => void;
  onPickImages: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * The stage form — "Ngày - Nhân sự", "Dịch vụ đã chọn" and "Nội dung điều trị"
 * side by side inside one blue-bordered card, as the reference draws it.
 *
 * Every control fills its column; the reference's fields are all 366px wide at
 * a 1600px viewport, which is the full width of a third of the card.
 */
export function StageForm({
  line,
  options,
  staffId,
  subStaffId,
  secondStaffId,
  note,
  pending,
  saving,
  primaryLabel,
  onStaff,
  onSubStaff,
  onSecondStaff,
  onNote,
  onPickImages,
  onCancel,
  onSave,
}: Props) {
  return (
    <div className="pd-stage-form">
      <div>
        <FloatingLabel label={t("Ngày tạo")} floated>
          <Input disabled value={formatDate(new Date().toISOString())} />
        </FloatingLabel>
        <FloatingLabel label={t("Bác sĩ")} floated={Boolean(staffId)}>
          <Select
            showSearch
            optionFilterProp="label"
            value={staffId}
            options={options}
            onChange={onStaff}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Phụ tá")} floated={Boolean(subStaffId)}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={subStaffId}
            options={options}
            onChange={onSubStaff}
          />
        </FloatingLabel>
        <FloatingLabel label={t("Bác sĩ hỗ trợ")} floated={Boolean(secondStaffId)}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={secondStaffId}
            options={options}
            onChange={onSecondStaff}
          />
        </FloatingLabel>
      </div>

      <div>
        <FloatingLabel label={t("Dịch vụ")} floated>
          <Input disabled value={line.serviceName ?? line.code} />
        </FloatingLabel>
        <div className="pd-stage-teeth">
          <p>{t("Răng")}:</p>
          <div>
            {toothLabels(line.teeth).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <div className="pd-stage-images">
          <p>{t("Hình ảnh")}:</p>
          <p>
            {pending.length === 0
              ? t("(Trống)")
              : t("{0} ảnh đã chọn", pending.length)}
          </p>
        </div>
        <Button block icon={<PictureOutlined />} onClick={onPickImages}>
          {t("Tải Ảnh")}
        </Button>
      </div>

      <div>
        <FloatingLabel label={t("Nội dung điều trị")} floated={note.length > 0}>
          <Input.TextArea
            rows={5}
            value={note}
            maxLength={NOTE_LIMIT}
            onChange={(event) => onNote(event.target.value)}
          />
        </FloatingLabel>
        <p className="pd-stage-list">{t("Danh sách công đoạn")}</p>
        <p className="pd-stage-listempty">{t("(Trống)")}</p>
        <div className="pd-stage-formactions">
          <Button onClick={onCancel}>{t("Hủy")}</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
