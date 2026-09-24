import { ToothChartCell } from "./ToothChartCell";
import { DENTITION_HALVES, type Dentition, type ToothPick, type ToothSurface } from "./toothModel";
import "./ToothChart.css";

interface Props {
  value: ToothPick[];
  /** Adult chart by default; the "Răng sữa" radio switches to the baby-teeth one. */
  dentition?: Dentition;
  /** Apply with {@link toggleTooth} / {@link toggleSurface} on the owner's state. */
  onToggleTooth: (fdi: number) => void;
  onToggleSurface: (fdi: number, surface: ToothSurface) => void;
  /**
   * The teeth that may be clicked at all; the rest are drawn grey and inert.
   * Omitted, every tooth is live — the consulting and plan pickers.
   */
  enabledTeeth?: ReadonlySet<number>;
  /** Surfaces are shown but not clickable — a công đoạn inherits its line's. */
  surfacesReadOnly?: boolean;
}

/**
 * The reference's tooth-and-surface picker: 32 permanent (or 20 deciduous)
 * teeth in four quadrants split by hairlines, each with a five-surface circle. The chart
 * only reports clicks; the owner folds them into its state so rapid clicks
 * never race a stale value.
 */
export function ToothChart({
  value,
  dentition = "permanent",
  onToggleTooth,
  onToggleSurface,
  enabledTeeth,
  surfacesReadOnly = false,
}: Props) {
  return (
    <div className={["tc-chart", dentition === "deciduous" && "tc-chart--deciduous"].filter(Boolean).join(" ")}>
      <span className="tc-divider tc-divider--v" aria-hidden="true" />
      <span className="tc-divider tc-divider--h" aria-hidden="true" />
      <div className="tc-grid">
        {DENTITION_HALVES[dentition].map((half) => (
          <div key={`${half.jaw}-${half.teeth[0]}`} className="tc-half">
            {half.teeth.map((fdi) => (
              <ToothChartCell
                key={fdi}
                fdi={fdi}
                jaw={half.jaw}
                pick={value.find((pick) => pick.fdi === fdi)}
                disabled={enabledTeeth !== undefined && !enabledTeeth.has(fdi)}
                surfacesReadOnly={surfacesReadOnly}
                onToggleTooth={onToggleTooth}
                onToggleSurface={onToggleSurface}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
