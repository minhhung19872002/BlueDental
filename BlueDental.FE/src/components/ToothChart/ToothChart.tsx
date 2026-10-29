import { ToothChartCell, type ToothAccess } from "./ToothChartCell";
import { DENTITION_HALVES, type Dentition, type ToothPick, type ToothSurface } from "./toothModel";
import "./ToothChart.css";

interface ChartProps {
  value: ToothPick[];
  /** Adult chart by default; the "Răng sữa" radio switches to the baby-teeth one. */
  dentition?: Dentition;
  /**
   * The teeth the owner offers; the rest are drawn grey and inert. Omitted,
   * every tooth is offered — the consulting and plan pickers.
   */
  offeredTeeth?: ReadonlySet<number>;
  /** Picked teeth that are finished; they read green instead of blue. */
  doneTeeth?: ReadonlySet<number>;
}

/**
 * What an offered tooth answers to — see {@link ToothAccess}; `open` by
 * default. A picker reports clicks — apply them with {@link toggleTooth} /
 * {@link toggleSurface} on the owner's state. A `view` chart is only looked at
 * and takes no handlers.
 */
type Props = ChartProps &
  (
    | {
        interaction?: "open" | "tooth";
        onToggleTooth: (fdi: number) => void;
        onToggleSurface: (fdi: number, surface: ToothSurface) => void;
      }
    | { interaction: "view"; onToggleTooth?: never; onToggleSurface?: never }
  );

/**
 * The reference's tooth-and-surface picker: 32 permanent (or 20 deciduous)
 * teeth in four quadrants split by hairlines, each with a five-surface circle. The chart
 * only reports clicks; the owner folds them into its state so rapid clicks
 * never race a stale value.
 */
export function ToothChart({
  value,
  dentition = "permanent",
  offeredTeeth,
  doneTeeth,
  interaction = "open",
  onToggleTooth,
  onToggleSurface,
}: Props) {
  const accessOf = (fdi: number): ToothAccess =>
    offeredTeeth === undefined || offeredTeeth.has(fdi) ? interaction : "off";

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
                access={accessOf(fdi)}
                done={doneTeeth?.has(fdi)}
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
