import { t } from "@/lib/i18n";
import type { SendListCount } from "../../api/sendApi";
import { CARE_TABS, type CareTabKey } from "../../careTabs";

interface SendListChipsProps {
  active: CareTabKey;
  counts: readonly SendListCount[] | undefined;
  onChange: (key: CareTabKey) => void;
}

/** The 10 CSKH tabs as one-pick chips, each with its customers over the period on screen. */
export function SendListChips({ active, counts, onChange }: SendListChipsProps) {
  return (
    <div className="snd-lists">
      <span className="snd-lists-hint" id="snd-lists-hint">
        {t("CSKH:Send:PickList")}
      </span>
      <div className="snd-chips" role="radiogroup" aria-labelledby="snd-lists-hint">
        {CARE_TABS.map((tab) => {
          const selected = tab.key === active;
          const count = counts?.find((item) => item.type === tab.type)?.count;
          return (
            <button
              key={tab.key}
              type="button"
              role="radio"
              aria-checked={selected}
              className={["snd-chip", selected && "snd-chip--on"].filter(Boolean).join(" ")}
              onClick={() => onChange(tab.key)}
            >
              {tab.label()}
              <span className="snd-chip-badge">{count ?? "…"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
