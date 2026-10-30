import { Form, Input } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_TOOTH_RESULT, type LaboToothResult } from "@/features/labo/api/laboApi";
import { toothKey } from "./laboCheckRules";

interface ToggleProps {
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
function ToothResultToggle({ value, onChange, disabled, tooth }: ToggleProps) {
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

interface Props {
  /** The teeth still to check this round. */
  teeth: number[];
  /** Passed on an earlier round; shown locked. */
  passed: number[];
  editable: boolean;
}

/** B. Kiểm tra từng răng: a result per tooth, and what is wrong with a Lỗi one. */
export function LaboToothCheckList({ teeth, passed, editable }: Props) {
  return (
    <section className="pd-labo-check-section">
      <header className="pd-labo-check-head">
        <span className="pd-labo-check-badge">B</span>
        <h3>{t("Labo:Check:TeethTitle")}</h3>
        <span className="pd-labo-check-aside">{t("Labo:Check:TeethHint")}</span>
      </header>
      <ul className="pd-labo-tooth-list">
        {teeth.map((tooth) => (
          <li key={tooth} className="pd-labo-tooth-row">
            <span className="pd-labo-tooth-no">{t("Labo:Check:ToothLabel", tooth)}</span>
            <Form.Item
              name={["teeth", toothKey(tooth), "result"]}
              rules={[{ required: true, message: t("Labo:Check:ResultRequired") }]}
              className="pd-labo-tooth-field"
            >
              <ToothResultToggle tooth={tooth} disabled={!editable} />
            </Form.Item>
            <Form.Item noStyle dependencies={[["teeth", toothKey(tooth), "result"]]}>
              {({ getFieldValue }) =>
                getFieldValue(["teeth", toothKey(tooth), "result"]) === LABO_TOOTH_RESULT.Failed && (
                  <Form.Item name={["teeth", toothKey(tooth), "note"]} className="pd-labo-tooth-note">
                    <Input placeholder={t("Labo:Check:DefectNote")} maxLength={500} disabled={!editable} />
                  </Form.Item>
                )
              }
            </Form.Item>
          </li>
        ))}
        {passed.map((tooth) => (
          <li key={tooth} className="pd-labo-tooth-row pd-labo-tooth-row--locked">
            <span className="pd-labo-tooth-no">{t("Labo:Check:ToothLabel", tooth)}</span>
            <span className="pd-labo-tooth-choice pd-labo-tooth-choice--pass">
              <CheckOutlined />
              {t("Labo:Check:PassedEarlier")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
