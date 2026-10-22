import { Button, Checkbox } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import {
  PERIOD_GRAINS,
  PERIOD_PRESETS,
  formatPeriodRange,
  periodDays,
  type PeriodPreset,
  type PeriodRangeValue,
} from "./periodGrain";
import { PeriodGridDays } from "./PeriodGridDays";
import { PeriodGridUnits } from "./PeriodGridUnits";
import { PeriodRangeHeader } from "./PeriodRangeHeader";
import { usePeriodDraft, type PeriodDraft } from "./usePeriodDraft";

interface Props {
  initial: PeriodRangeValue;
  /** The longest period the screen can read; Áp dụng waits until the pick fits. */
  maxDays?: number;
  onApply: (value: PeriodRangeValue) => void;
  onCancel: () => void;
}

function presetActive(draft: PeriodDraft, preset: PeriodPreset): boolean {
  if (draft.grain !== "day" || draft.picking) return false;
  const { from, to } = preset.resolve(dayjs().startOf("day"));
  return from.isSame(draft.from, "day") && to.isSame(draft.to, "day");
}

function PeriodGrid({ draft }: { draft: PeriodDraft }) {
  const { from, to } = draft.shown;
  if (draft.grain === "day") {
    return <PeriodGridDays view={draft.view} from={from} to={to} onPick={draft.pick} onHover={draft.hover} />;
  }
  return (
    <PeriodGridUnits
      grain={draft.grain}
      view={draft.view}
      from={from}
      to={to}
      onPick={draft.pick}
      onHover={draft.hover}
    />
  );
}

/** The popover body: Chọn theo, the presets, the grid and Áp dụng (BA P2110). */
export function PeriodRangePanel({ initial, maxDays, onApply, onCancel }: Props) {
  const draft = usePeriodDraft(initial);
  const picked = draft.toValue();
  const tooLong = maxDays !== undefined && periodDays(dayjs(picked.from), dayjs(picked.to)) > maxDays;

  return (
    <div className="bd-prp-panel">
      <nav className="bd-prp-side" aria-label={t("PeriodRange:ChooseBy")}>
        <span className="bd-prp-side-title">{t("PeriodRange:ChooseBy")}</span>
        {PERIOD_GRAINS.map((grain) => (
          <button
            key={grain}
            type="button"
            aria-pressed={draft.grain === grain}
            className={["bd-prp-grain", draft.grain === grain && "bd-prp-grain--active"].filter(Boolean).join(" ")}
            onClick={() => draft.setGrain(grain)}
          >
            {t(`PeriodRange:Grain:${grain}`)}
          </button>
        ))}
      </nav>

      <div className="bd-prp-main">
        <div className="bd-prp-presets">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              aria-pressed={presetActive(draft, preset)}
              className={["bd-prp-chip", presetActive(draft, preset) && "bd-prp-chip--active"].filter(Boolean).join(" ")}
              onClick={() => draft.applyPreset(preset)}
            >
              {t(`PeriodRange:Preset:${preset.key}`)}
            </button>
          ))}
        </div>
        <PeriodRangeHeader grain={draft.grain} view={draft.view} onPage={draft.page} />
        <PeriodGrid draft={draft} />
        <p className="bd-prp-hint">{t("PeriodRange:Hint", t(`PeriodRange:Noun:${draft.grain}`))}</p>
      </div>

      <footer className="bd-prp-foot">
        <div className="bd-prp-selecting">
          <span>{t("PeriodRange:Selecting")}</span>
          <strong>{formatPeriodRange(picked.grain, dayjs(picked.from), dayjs(picked.to))}</strong>
          {tooLong && <span className="bd-prp-error">{t("PeriodRange:TooLong", maxDays)}</span>}
        </div>
        <Checkbox checked={draft.compare} onChange={(event) => draft.setCompare(event.target.checked)}>
          {t("PeriodRange:Compare")}
        </Checkbox>
        <div className="bd-prp-actions">
          <Button onClick={onCancel}>{t("Common:Cancel")}</Button>
          <Button type="primary" disabled={tooLong} onClick={() => onApply(picked)}>
            {t("PeriodRange:Apply")}
          </Button>
        </div>
      </footer>
    </div>
  );
}
