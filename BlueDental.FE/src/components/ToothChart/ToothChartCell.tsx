import { t } from "@/lib/i18n";
import { ToothSurfaceCircle } from "./ToothSurfaceCircle";
import { isMolar, type Jaw, type ToothPick, type ToothSurface } from "./toothModel";

/**
 * What can be clicked on one tooth: `open` — the tooth and its surfaces;
 * `tooth` — the tooth only, its surfaces just shown; `view` — nothing, drawn as
 * usual; `off` — nothing, greyed out as a tooth the owner does not offer.
 */
export type ToothAccess = "open" | "tooth" | "view" | "off";

interface Props {
  fdi: number;
  jaw: Jaw;
  pick: ToothPick | undefined;
  access: ToothAccess;
  /** Finished: the pick reads green instead of blue. */
  done?: boolean;
  onToggleTooth?: (fdi: number) => void;
  onToggleSurface?: (fdi: number, surface: ToothSurface) => void;
}

/**
 * One tooth: the picture with its FDI number, plus the surface circle. Upper
 * teeth hang crown-down over the circle; lower teeth stand crown-up under it,
 * so the two jaws mirror each other around the horizontal divider.
 */
export function ToothChartCell({
  fdi,
  jaw,
  pick,
  access,
  done = false,
  onToggleTooth,
  onToggleSurface,
}: Props) {
  const molar = isMolar(fdi);
  const selected = pick !== undefined;

  const tooth = (
    <button
      type="button"
      className={["tc-tooth", selected && "tc-tooth--selected"].filter(Boolean).join(" ")}
      aria-pressed={selected}
      aria-label={t("Common:Tooth:Label", fdi)}
      disabled={access === "view" || access === "off"}
      onClick={() => onToggleTooth?.(fdi)}
    >
      {jaw === "lower" && <span className="tc-tooth__num">{fdi}</span>}
      <span className={["tc-tooth__img", jaw === "lower" && "tc-tooth__img--lower"].filter(Boolean).join(" ")}>
        <img
          src={molar ? "/img/teeth/molars.png" : "/img/teeth/premolars.png"}
          alt={molar ? t("Common:Tooth:Molar") : t("Common:Tooth:Anterior")}
          draggable={false}
        />
      </span>
      {jaw === "upper" && <span className="tc-tooth__num">{fdi}</span>}
    </button>
  );

  const circle = (
    <ToothSurfaceCircle
      fdi={fdi}
      selected={pick?.surfaces ?? []}
      disabled={access !== "open"}
      onToggle={(surface) => onToggleSurface?.(fdi, surface)}
    />
  );

  return (
    <div className="tc-cell" data-access={access} data-done={done || undefined}>
      {jaw === "upper" ? tooth : circle}
      {jaw === "upper" ? circle : tooth}
    </div>
  );
}
