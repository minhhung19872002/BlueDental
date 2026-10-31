import { t } from "@/lib/i18n";

export interface WarrantyChip<K extends string | number> {
  key: K;
  /** i18n key. */
  label: string;
  count?: number;
  /** The orange dot of "● Sẵn sàng kích hoạt" (m366). */
  dot?: boolean;
  /** Nha khoa green / Labo purple text (m360). */
  tone?: "dental" | "labo";
}

interface Props<K extends string | number> {
  chips: WarrantyChip<K>[];
  value: K;
  label: string;
  onChange: (key: K) => void;
}

/** The outline chips at the right of each card's title; the picked one wears the indigo ring. */
export function WarrantyFilterChips<K extends string | number>({ chips, value, label, onChange }: Props<K>) {
  return (
    <div className="pwt-chips" role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={chip.key === value}
          className={["pwt-chip", chip.key === value && "pwt-chip--on", chip.tone && `pwt-chip--${chip.tone}`]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(chip.key)}
        >
          {chip.dot && <span className="pwt-chip-dot" aria-hidden="true" />}
          {t(chip.label)}
          {chip.count !== undefined && ` ${chip.count}`}
        </button>
      ))}
    </div>
  );
}
