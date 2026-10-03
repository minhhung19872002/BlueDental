import { t } from "@/lib/i18n";
import { BLOCK_STATES, BLOCK_STATE_LABEL_KEY } from "./blockState";

/** The colour key under the timeline — one swatch per block state. */
export function TimelineLegend() {
  return (
    <div className="dtl-legend">
      {BLOCK_STATES.map((state) => (
        <span key={state} className="dtl-legend-item">
          <span className={`dtl-legend-swatch dtl-block--${state}`} />
          {t(BLOCK_STATE_LABEL_KEY[state])}
        </span>
      ))}
    </div>
  );
}
