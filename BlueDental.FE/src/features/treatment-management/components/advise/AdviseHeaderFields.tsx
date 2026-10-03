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
 * The two rows over the service table in "Chọn Dịch Vụ": where the work is
 * and who is advising, then the diagnosis being answered. Only the
 * consultants can be changed here. The disabled "Bác sĩ chẩn đoán 1/2" pair
 * staging shows beside the diagnosis is left out — it only repeated the
 * slip's own doctors (project owner, 2026-10-03).
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
        <span className="am-static-label">{t("Treatment:Consulting:ToothLocation")}</span>
        <span className="am-static-value am-static-value--accent">
          {toothLabel ? t("Treatment:Tooth:ToothLabel", toothLabel) : t("Treatment:Tooth:ToothNotSelected")}
        </span>
        <button type="button" className="tp-tooth-btn" aria-label={t("Treatment:Tooth:SelectTooth")} onClick={onPickTeeth}>
          <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
        </button>
      </div>

      <div className="am-consultant">
        <FloatingField
          name="staffId"
          label={t("Treatment:Consulting:Advisor1")}
          required
          rules={[{ required: true, message: t("Treatment:Consulting:AdvisorRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={staff}
            {...SELECT_ICONS}
          />
        </FloatingField>
        {!secondOpen && (
          <Tooltip title={t("Treatment:Consulting:AddAdvisor")}>
            <Button
              shape="circle"
              className="am-round"
              aria-label={t("Treatment:Consulting:AddAdvisor")}
              icon={<Plus size={18} />}
              onClick={() => onSecondOpenChange(true)}
            />
          </Tooltip>
        )}
      </div>

      {secondOpen ? (
        <div className="am-consultant">
          <FloatingField name="secondStaffId" label={t("Treatment:Consulting:Advisor2")}>
            <Select showSearch allowClear optionFilterProp="label" options={staff} {...SELECT_ICONS} />
          </FloatingField>
          <Tooltip title={t("Treatment:Consulting:RemoveAdvisor2")}>
            <Button
              danger
              shape="circle"
              className="am-round"
              aria-label={t("Treatment:Consulting:RemoveAdvisor2")}
              icon={<X size={17} strokeWidth={2.5} />}
              onClick={() => onSecondOpenChange(false)}
            />
          </Tooltip>
        </div>
      ) : (
        <div />
      )}

      <div className="am-static">
        <span className="am-static-label">{t("Treatment:Diagnosis:Diagnosis")}</span>
        <span className="am-static-value">{diagnosis.diagnosisName}</span>
      </div>
    </div>
  );
}
