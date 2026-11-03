import { Form, Select } from "antd";
import { formatToothValue, type ToothPickerValue } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { foldFilterOption } from "@/utils/foldForSearch";
import type { PatientDiagnosisDto } from "../../api/consultingApi";

interface StaffChoice {
  value: string;
  label: string;
}

interface Props {
  diagnosis: PatientDiagnosisDto;
  teeth: ToothPickerValue;
  staff: StaffChoice[];
  onPickTeeth: () => void;
}

/**
 * The strip over the picker of "Chọn dịch vụ" (P0111_02, R-1114): where the
 * work is, the diagnosis being answered, and the two consultants — four
 * columns, labels above. Only the teeth and the consultants can be changed;
 * the second consultant is optional and always offered, no "+" to open it.
 */
export function AdviseHeaderFields({ diagnosis, teeth, staff, onPickTeeth }: Props) {
  const toothLabel = formatToothValue(teeth);

  return (
    <div className="am-strip">
      <div className="am-strip-field">
        <span className="am-strip-label">{t("Treatment:Consulting:ToothLocation")}</span>
        <div className="am-strip-box">
          <span className={toothLabel ? "am-strip-value am-strip-value--accent" : "am-strip-value am-muted"}>
            {toothLabel ? t("Treatment:Tooth:ToothLabel", toothLabel) : t("Treatment:Tooth:ToothNotSelected")}
          </span>
          <button type="button" className="am-tooth-btn" aria-label={t("Treatment:Tooth:SelectTooth")} onClick={onPickTeeth}>
            <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
          </button>
        </div>
      </div>

      <div className="am-strip-field">
        <span className="am-strip-label">{t("Treatment:Diagnosis:Diagnosis")}</span>
        <div className="am-strip-box">
          <span className="am-strip-value">{diagnosis.diagnosisName}</span>
        </div>
      </div>

      <div className="am-strip-field">
        <label className="am-strip-label" htmlFor="am-staff-1">
          {t("Treatment:Consulting:Advisor1")} <span className="am-required">*</span>
        </label>
        <Form.Item name="staffId" rules={[{ required: true, message: t("Treatment:Consulting:AdvisorRequired") }]}>
          <Select id="am-staff-1" showSearch filterOption={foldFilterOption} options={staff} />
        </Form.Item>
      </div>

      <div className="am-strip-field">
        <label className="am-strip-label" htmlFor="am-staff-2">
          {t("Treatment:Consulting:Advisor2")}
        </label>
        <Form.Item name="secondStaffId">
          <Select
            id="am-staff-2"
            showSearch
            allowClear
            filterOption={foldFilterOption}
            options={staff}
            placeholder={t("Treatment:Advise:Advisor2Placeholder")}
          />
        </Form.Item>
      </div>
    </div>
  );
}
