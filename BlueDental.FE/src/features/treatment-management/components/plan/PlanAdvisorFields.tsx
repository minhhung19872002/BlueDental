import { useState, type ReactNode } from "react";
import { Form, Select, Tooltip } from "antd";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  dentists: { id: string; name: string }[];
  /** Whether the slip already names a second advisor when the dialog opens. */
  hasSecond: boolean;
  /** The service picker: beside the advisor while there is one, on its own row once there are two. */
  picker: ReactNode;
}

/**
 * Top of "Cập nhật phiếu dịch vụ": the advising staff, one or two of them.
 * The round "+" beside the first opens a second field; the red "×" beside
 * the second folds it away again, the way the reference does.
 */
export function PlanAdvisorFields({ dentists, hasSecond, picker }: Props) {
  const form = Form.useFormInstance();
  const [secondShown, setSecondShown] = useState(hasSecond);
  const options = dentists.map((item) => ({ value: item.id, label: item.name }));
  const prefix = <Search size={20} aria-hidden="true" />;
  const suffixIcon = <ChevronDown size={16} aria-hidden="true" />;

  const hideSecond = () => {
    form.setFieldValue("secondAdvisorId", undefined);
    setSecondShown(false);
  };

  return (
    <div className="tp-advisors">
      <div className="tp-create-grid tp-advisor-row">
        <div className="tp-advisor-field">
          <FloatingField
            name="advisorId"
            label={t("Nhân sự tư vấn 1")}
            rules={[{ required: true, message: t("Vui lòng chọn nhân sự tư vấn") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              prefix={prefix}
              suffixIcon={suffixIcon}
              options={options}
            />
          </FloatingField>
          {!secondShown && (
            <Tooltip title={t("Thêm nhân sự tư vấn")}>
              <button
                type="button"
                className="tp-round-btn"
                aria-label={t("Thêm nhân sự tư vấn")}
                onClick={() => setSecondShown(true)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
        {secondShown ? (
          <div className="tp-advisor-field">
            <FloatingField name="secondAdvisorId" label={t("Nhân sự tư vấn 2")}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                prefix={prefix}
                suffixIcon={suffixIcon}
                options={options}
              />
            </FloatingField>
            <Tooltip title={t("Tắt nhân sự tư vấn 2")}>
              <button
                type="button"
                className="tp-round-btn tp-round-btn--danger"
                aria-label={t("Tắt nhân sự tư vấn 2")}
                onClick={hideSecond}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        ) : (
          picker
        )}
      </div>
      {secondShown && picker}
    </div>
  );
}
