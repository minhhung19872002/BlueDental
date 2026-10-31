import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_TOOTH_RESULT, type LaboToothResult } from "@/features/labo/api/laboApi";

interface Props {
  value?: LaboToothResult;
  onChange?: (value: LaboToothResult) => void;
  disabled?: boolean;
  tooth: number;
}

const CHOICES = [
  { result: LABO_TOOTH_RESULT.Passed, label: "Labo:Check:Pass", icon: <CheckOutlined />, tone: "pass" },
  { result: LABO_TOOTH_RESULT.Failed, label: "Labo:Check:Fail", icon: <CloseOutlined />, tone: "fail" },
] as const;

/** Đạt / Lỗi as two pressed-state buttons, driven by the Form.Item around it. */
export function LaboToothResultToggle({ value, onChange, disabled, tooth }: Props) {
  return (
    <div className="pd-labo-tooth-toggle" role="group" aria-label={t("Labo:Check:ToothLabel", tooth)}>
      {CHOICES.map((choice) => {
        const pressed = value === choice.result;
        return (
          <button
            key={choice.result}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            className={["pd-labo-tooth-choice", pressed && `pd-labo-tooth-choice--${choice.tone}`]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange?.(choice.result)}
          >
            {choice.icon}
            {t(choice.label)}
          </button>
        );
      })}
    </div>
  );
}
