import { Button, Select, Tooltip } from "antd";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { formatToothValue, type ToothPickerValue } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import type { PatientDiagnosisDto } from "../../api/consultingApi";

interface StaffChoice {
  value: string;
  label: string;
}

interface Props {
  diagnosis: PatientDiagnosisDto;
  teeth: ToothPickerValue;
  staff: StaffChoice[];
  /** Whether the "Nhân sự tư vấn 2" column is showing. */
  secondOpen: boolean;
  onPickTeeth: () => void;
  onSecondOpenChange: (open: boolean) => void;
}

const SELECT_ICONS = {
  prefix: <Search size={20} />,
  suffixIcon: <ChevronDown size={16} />,
};

/**
 * The two rows over the service table in "Chọn Dịch Vụ", as staging lays them
 * out: where the work is and who is advising, then the diagnosis being
 * answered and who made it. Only the consultants can be changed here — the
 * diagnosis fields are the slip's own and stay disabled.
 */
export function AdviseHeaderFields({
  diagnosis,
  teeth,
  staff,
  secondOpen,
  onPickTeeth,
  onSecondOpenChange,
}: Props) {
  const toothLabel = formatToothValue(teeth);

  return (
    <div className="am-grid">
      <div className="am-static">
        <span className="am-static-label">{t("Vị trí răng / Vùng điều trị")}</span>
        <span className="am-static-value am-static-value--accent">
          {toothLabel ? t("Răng {0}", toothLabel) : t("Chưa chọn răng")}
        </span>
        <button type="button" className="tp-tooth-btn" aria-label={t("Chọn răng")} onClick={onPickTeeth}>
          <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
        </button>
      </div>

      <div className="am-consultant">
        <FloatingField
          name="staffId"
          label={t("Nhân sự tư vấn 1")}
          required
          rules={[{ required: true, message: t("Vui lòng chọn nhân sự tư vấn") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={staff}
            {...SELECT_ICONS}
          />
        </FloatingField>
        {!secondOpen && (
          <Tooltip title={t("Thêm nhân sự tư vấn")}>
            <Button
              shape="circle"
              className="am-round"
              aria-label={t("Thêm nhân sự tư vấn")}
              icon={<Plus size={18} />}
              onClick={() => onSecondOpenChange(true)}
            />
          </Tooltip>
        )}
      </div>

      {secondOpen ? (
        <div className="am-consultant">
          <FloatingField name="secondStaffId" label={t("Nhân sự tư vấn 2")}>
            <Select showSearch allowClear optionFilterProp="label" options={staff} {...SELECT_ICONS} />
          </FloatingField>
          <Tooltip title={t("Tắt nhân sự tư vấn 2")}>
            <Button
              danger
              shape="circle"
              className="am-round"
              aria-label={t("Tắt nhân sự tư vấn 2")}
              icon={<X size={17} strokeWidth={2.5} />}
              onClick={() => onSecondOpenChange(false)}
            />
          </Tooltip>
        </div>
      ) : (
        <div />
      )}

      <div className="am-static">
        <span className="am-static-label">{t("Chẩn đoán")}</span>
        <span className="am-static-value">{diagnosis.diagnosisName}</span>
      </div>

      <FloatingField name="diagnoserId" label={t("Bác sĩ chẩn đoán 1")}>
        <Select disabled options={staff} {...SELECT_ICONS} />
      </FloatingField>

      <FloatingField name="secondDiagnoserId" label={t("Bác sĩ chẩn đoán 2")}>
        <Select disabled options={staff} {...SELECT_ICONS} />
      </FloatingField>
    </div>
  );
}
