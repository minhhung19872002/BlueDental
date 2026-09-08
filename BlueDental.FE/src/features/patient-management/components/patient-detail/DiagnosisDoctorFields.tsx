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
      <FloatingField name="staffId" label={t("Bác sĩ chẩn đoán 1")} required>
        <Select
          showSearch
          optionFilterProp="label"
          prefix={<SearchOutlined />}
          options={dentists}
          notFoundContent={t("Không tìm thấy kết quả")}
        />
      </FloatingField>

      {secondEnabled ? (
        <>
          <FloatingField name="secondStaffId" label={t("Chẩn đoán 2")}>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              prefix={<SearchOutlined />}
              options={dentists}
              notFoundContent={t("Không tìm thấy kết quả")}
            />
          </FloatingField>
          <Tooltip title={t("Tắt Chẩn đoán 2")}>
            <Button
              shape="circle"
              danger
              className="pd-diagnosis-round"
              aria-label={t("Tắt Chẩn đoán 2")}
              icon={<CloseOutlined />}
              onClick={onToggleSecond}
            />
          </Tooltip>
        </>
      ) : (
        <Tooltip title={t("Thêm bác sĩ chẩn đoán")}>
          <Button
            shape="circle"
            className="pd-diagnosis-round"
            aria-label={t("Thêm bác sĩ chẩn đoán")}
            icon={<PlusOutlined />}
            onClick={onToggleSecond}
          />
        </Tooltip>
      )}
    </div>
  );
}
