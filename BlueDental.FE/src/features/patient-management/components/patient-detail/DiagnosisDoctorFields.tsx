import { Button, Select, Tooltip } from "antd";
import { CloseOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

export interface DiagnosisOption {
  value: string;
  label: string;
}

interface Props {
  dentists: DiagnosisOption[];
  secondEnabled: boolean;
  onToggleSecond: () => void;
}

/**
 * The first row of "Tạo chẩn đoán": the diagnosing doctor, a round + that
 * brings in a second one, and — once it is in — the second doctor with a red
 * X ("Tắt Chẩn đoán 2") that takes it out again. Both are the reference's
 * search combobox: a search glass in front of a floating label.
 */
export function DiagnosisDoctorFields({ dentists, secondEnabled, onToggleSecond }: Props) {
  return (
    <div className="pd-diagnosis-doctors">
      <FloatingField name="staffId" label={t("Patient:Diagnosis:Doctor1")} required>
        <Select
          showSearch
          optionFilterProp="label"
          prefix={<SearchOutlined />}
          options={dentists}
          notFoundContent={t("Common:NoResults")}
        />
      </FloatingField>

      {secondEnabled ? (
        <>
          <FloatingField name="secondStaffId" label={t("Patient:Diagnosis:Doctor2")}>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              prefix={<SearchOutlined />}
              options={dentists}
              notFoundContent={t("Common:NoResults")}
            />
          </FloatingField>
          <Tooltip title={t("Patient:Diagnosis:DisableDoctor2")}>
            <Button
              shape="circle"
              danger
              className="pd-diagnosis-round"
              aria-label={t("Patient:Diagnosis:DisableDoctor2")}
              icon={<CloseOutlined />}
              onClick={onToggleSecond}
            />
          </Tooltip>
        </>
      ) : (
        <Tooltip title={t("Patient:Diagnosis:AddDoctor")}>
          <Button
            shape="circle"
            className="pd-diagnosis-round"
            aria-label={t("Patient:Diagnosis:AddDoctor")}
            icon={<PlusOutlined />}
            onClick={onToggleSecond}
          />
        </Tooltip>
      )}
    </div>
  );
}
