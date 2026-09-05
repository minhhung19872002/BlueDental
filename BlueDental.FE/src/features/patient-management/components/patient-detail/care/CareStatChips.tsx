import { Fragment } from "react";
import type { CareStatsDto } from "@/features/cskh/api/careApi";
import { t } from "@/lib/i18n";
import { CARE_CHIPS, type CareChipKey } from "./careChips";

interface Props {
  stats?: CareStatsDto;
  active: CareChipKey | null;
  onToggle: (key: CareChipKey) => void;
}

export function CareStatChips({ stats, active, onToggle }: Props) {
  return (
    <div className="pc-chips" role="group" aria-label={t("Bộ lọc chăm sóc")}>
      {CARE_CHIPS.map((chip) => {
        const pressed = active === chip.key;
        return (
          <Fragment key={chip.key}>
            {chip.dividerBefore ? <span className="pc-chips-divider" aria-hidden /> : null}
            <button
              type="button"
              className={["pc-chip", `pc-chip--${chip.tone}`, pressed && "pc-chip--active"]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={pressed}
              onClick={() => onToggle(chip.key)}
            >
              <b className="pc-chip-count">{stats?.[chip.stat] ?? 0}</b>
              <span className="pc-chip-label">{t(chip.label)}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
