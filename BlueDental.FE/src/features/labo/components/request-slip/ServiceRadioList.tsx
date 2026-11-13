import { Radio } from "antd";
import { t } from "@/lib/i18n";
import type { SlipServiceItem } from "./restorationChoices";
import { SectionBadge } from "./SectionBadge";

interface Props {
  items: SlipServiceItem[];
  value: string | undefined;
  editable: boolean;
  onChange: (serviceId: string) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/** Dịch vụ * of the Phiếu yêu cầu (P1311): one row per Dịch vụ of Dịch vụ Labo, one picked by radio. */
export function ServiceRadioList({ items, value, editable, onChange, title }: Props) {
  const heading = title ?? t("Labo:Slip:Service");
  const picked = items.find((item) => item.value === value)?.label;

  return (
    <section className="rs-sec">
      <div className="rs-sech">
        <span>
          {heading} <span className="rs-req">*</span>
        </span>
        <SectionBadge tone={picked ? "ok" : "miss"}>{picked ?? t("Labo:Slip:NotPicked")}</SectionBadge>
      </div>
      {items.length === 0 ? (
        <p className="rs-empty">{t("Labo:Slip:NoServices")}</p>
      ) : (
        <Radio.Group
          className="rs-klist"
          value={value}
          disabled={!editable}
          aria-label={heading}
          onChange={(event) => onChange(String(event.target.value))}
        >
          {items.map((item) => (
            <label key={item.value} className={item.value === value ? "rs-krow rs-on" : "rs-krow"}>
              <span className="rs-grow">{item.label}</span>
              <Radio value={item.value} aria-label={item.label} />
            </label>
          ))}
        </Radio.Group>
      )}
    </section>
  );
}
