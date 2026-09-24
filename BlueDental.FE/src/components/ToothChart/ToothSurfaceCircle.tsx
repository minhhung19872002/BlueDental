import { t } from "@/lib/i18n";
import { TOOTH_SURFACES, surfaceLabel, type ToothSurface } from "./toothModel";

interface Props {
  fdi: number;
  selected: ToothSurface[];
  /** Shown but not clickable. */
  disabled?: boolean;
  onToggle: (surface: ToothSurface) => void;
}

/**
 * The 28px surface picker under (or over) each tooth: a 2×2 grid rotated 45°
 * so its cells become top/right/left/bottom wedges, with the occlusal disc
 * sitting on top in the centre.
 */
export function ToothSurfaceCircle({ fdi, selected, disabled = false, onToggle }: Props) {
  return (
    <div className="tc-circle" role="group" aria-label={t("Common:Tooth:Surface", fdi)}>
      {TOOTH_SURFACES.map((surface) => {
        const active = selected.includes(surface);
        const label = surfaceLabel(fdi, surface);
        return (
          <button
            key={surface}
            type="button"
            className={[surface === "center" ? "tc-circle__center" : "tc-circle__quad", active && "active"]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onToggle(surface)}
          />
        );
      })}
    </div>
  );
}
