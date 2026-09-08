import { useId } from "react";
import { t } from "@/lib/i18n";
import type { Dentition } from "./toothModel";

interface Props {
  value: Dentition;
  onChange: (dentition: Dentition) => void;
}

const DENTITIONS: readonly { key: Dentition; label: () => string }[] = [
  { key: "permanent", label: () => t("Răng vĩnh viễn") },
  { key: "deciduous", label: () => t("Răng sữa") },
];

/** "Răng vĩnh viễn / Răng sữa" — the reference's own 16px ring radios. */
export function DentitionRadio({ value, onChange }: Props) {
  const name = useId();

  return (
    <div className="tc-dentition" role="radiogroup" aria-label={t("Loại răng")}>
      {DENTITIONS.map((item) => (
        <label key={item.key} className="tc-radio">
          <input
            type="radio"
            name={name}
            value={item.key}
            checked={value === item.key}
            onChange={() => onChange(item.key)}
          />
          <span className="tc-radio__ring" aria-hidden="true" />
          {item.label()}
        </label>
      ))}
    </div>
  );
}
