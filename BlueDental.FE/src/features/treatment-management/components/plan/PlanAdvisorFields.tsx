import { useState, type ReactNode } from "react";
import { Form, Tooltip } from "antd";
import { Plus, X } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useStaffOptionsSearch } from "@/hooks/usePickerOptions";

interface Props {
  /** Whether the slip already names a second advisor when the dialog opens. */
  hasSecond: boolean;
  /**
   * What the slip's advisors are called. A preset id the first page of results
   * does not carry would otherwise render as a raw id.
   */
  advisorName?: string | null;
  secondAdvisorName?: string | null;
  /** The service picker: beside the advisor while there is one, on its own row once there are two. */
  picker: ReactNode;
}

/**
 * Top of "Cập nhật phiếu dịch vụ": the advising staff, one or two of them.
 * The round "+" beside the first opens a second field; the red "×" beside
 * the second folds it away again, the way the reference does.
 */
export function PlanAdvisorFields({
  hasSecond,
  advisorName,
  secondAdvisorName,
  picker,
}: Props) {
  const form = Form.useFormInstance();
  const [secondShown, setSecondShown] = useState(hasSecond);

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
            label={t("Treatment:Consulting:Advisor1")}
            required
            rules={[{ required: true, message: t("Treatment:Consulting:AdvisorRequired") }]}
          >
            <ServerSearchSelect
              useOptions={useStaffOptionsSearch}
              valueLabel={advisorName}
              notFoundText={t("Treatment:Consulting:NoAdvisor")}
            />
          </FloatingField>
          {!secondShown && (
            <Tooltip title={t("Treatment:Consulting:AddAdvisor")}>
              <button
                type="button"
                className="tp-round-btn"
                aria-label={t("Treatment:Consulting:AddAdvisor")}
                onClick={() => setSecondShown(true)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
        {secondShown ? (
          <div className="tp-advisor-field">
            <FloatingField name="secondAdvisorId" label={t("Treatment:Consulting:Advisor2")}>
              <ServerSearchSelect
                useOptions={useStaffOptionsSearch}
                valueLabel={secondAdvisorName}
                notFoundText={t("Treatment:Consulting:NoAdvisor")}
              />
            </FloatingField>
            <Tooltip title={t("Treatment:Consulting:RemoveAdvisor2")}>
              <button
                type="button"
                className="tp-round-btn tp-round-btn--danger"
                aria-label={t("Treatment:Consulting:RemoveAdvisor2")}
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
