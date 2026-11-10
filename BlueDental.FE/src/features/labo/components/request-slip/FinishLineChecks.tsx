import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import type { LaboFinishLineOption } from "@/hooks/useLaboPickers";
import { SectionBadge } from "./SectionBadge";

interface Props {
  options: LaboFinishLineOption[];
  value: string[];
  editable: boolean;
  onChange: (ids: string[]) => void;
}

/**
 * Đường hoàn tất: the labo_finish_line rows of Danh mục, several at once, each
 * row's description on hover. Not required.
 */
export function FinishLineChecks({ options, value, editable, onChange }: Props) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((one) => one !== id) : [...value, id]);

  return (
    <section className="rs-sec">
      <div className="rs-sech">
        {t("Labo:Slip:FinishLine")}
        <SectionBadge tone={value.length ? "ok" : "opt"}>
          {value.length ? t("Labo:Slip:PickedCount", String(value.length)) : t("Labo:Slip:Optional")}
        </SectionBadge>
      </div>
      {options.length === 0 ? (
        <p className="rs-empty">{t("Labo:Slip:NoFinishLines")}</p>
      ) : (
        <div className="rs-fingrid">
          {options.map((option) => {
            const on = value.includes(option.value);
            return (
              <label key={option.value} className={on ? "rs-krow rs-on" : "rs-krow"} title={option.description}>
                <span className="rs-grow">{option.label}</span>
                <Checkbox checked={on} disabled={!editable} onChange={() => toggle(option.value)} />
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
