import { useEffect, useRef, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { SKETCH_COLORS } from "./sketch";

/** How many colours of its own the clinic can keep beside the twenty. */
const CUSTOM_SLOTS = 10;

interface Props {
  color: string;
  /** Colours picked from the system picker this session, newest last. */
  custom: readonly string[];
  onPick: (color: string) => void;
  onAddCustom: (color: string) => void;
}

const swatchStyle = (color: string) => ({ "--swatch": color }) as CSSProperties;

/**
 * Paint's colour box, shared by every tool: the colour in use, then the twenty,
 * then a row for the clinic's own picked from the system's picker.
 */
export function SketchColors({ color, custom, onPick, onAddCustom }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const spare = Math.max(0, CUSTOM_SLOTS - custom.length);

  // The native "change", once the system picker closes — React's onChange
  // fires on every step of dragging through it, and would keep them all.
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const keep = () => {
      onAddCustom(input.value);
      onPick(input.value);
    };
    input.addEventListener("change", keep);
    return () => input.removeEventListener("change", keep);
  }, [onAddCustom, onPick]);

  return (
    <div className="sketch-colors" role="group" aria-label={t("Patient:MedRecord:Colors")}>
      <span
        className="sketch-colors-current"
        style={swatchStyle(color)}
        role="img"
        aria-label={`${t("Patient:MedRecord:Color1")}: ${color}`}
        title={t("Patient:MedRecord:Color1")}
      />
      <div className="sketch-colors-grid">
        {[...SKETCH_COLORS, ...custom].map((value, at) => (
          <button
            key={`${value}-${at}`}
            type="button"
            className={["sketch-swatch", color === value && "sketch-swatch--active"].filter(Boolean).join(" ")}
            style={swatchStyle(value)}
            aria-label={value}
            aria-pressed={color === value}
            title={value}
            onClick={() => onPick(value)}
          />
        ))}
        {Array.from({ length: spare }, (_, at) => (
          <button
            key={`spare-${at}`}
            type="button"
            className="sketch-swatch sketch-swatch--empty"
            aria-label={t("Patient:MedRecord:CustomColor")}
            title={t("Patient:MedRecord:CustomColor")}
            onClick={() => picker.current?.click()}
          >
            {at === 0 && <Plus size={12} />}
          </button>
        ))}
      </div>
      <input
        ref={picker}
        type="color"
        className="sketch-colors-picker"
        tabIndex={-1}
        aria-hidden="true"
        defaultValue={color}
      />
    </div>
  );
}
