import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { SKETCH_COLORS } from "./sketch";

export type ColorSlot = "color" | "fill";

/** How many colours of its own the clinic can keep beside the twenty. */
const CUSTOM_SLOTS = 10;

interface Props {
  color: string;
  fill: string;
  /** Colours picked from the system picker this session, newest last. */
  custom: readonly string[];
  onPick: (slot: ColorSlot, color: string) => void;
  onAddCustom: (color: string) => void;
}

const swatchStyle = (color: string) => ({ "--swatch": color }) as CSSProperties;

/**
 * Paint's colour box, shared by every tool: two large circles — colour 1, what
 * is drawn and written in, and colour 2, what words are filled with — then the
 * twenty, then a row for the clinic's own. Pressing a large circle chooses
 * which of the two the grid sets.
 */
export function SketchColors({ color, fill, custom, onPick, onAddCustom }: Props) {
  const [slot, setSlot] = useState<ColorSlot>("color");
  const picker = useRef<HTMLInputElement>(null);
  const current = slot === "color" ? color : fill;
  const spare = Math.max(0, CUSTOM_SLOTS - custom.length);

  // The native "change", once the system picker closes — React's onChange
  // fires on every step of dragging through it, and would keep them all.
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const keep = () => {
      onAddCustom(input.value);
      onPick(slot, input.value);
    };
    input.addEventListener("change", keep);
    return () => input.removeEventListener("change", keep);
  }, [slot, onAddCustom, onPick]);

  const circle = (which: ColorSlot, value: string, label: string) => (
    <button
      type="button"
      className={["sketch-colors-current", slot === which && "sketch-colors-current--active"].filter(Boolean).join(" ")}
      style={swatchStyle(value)}
      aria-pressed={slot === which}
      aria-label={label}
      title={label}
      onClick={() => setSlot(which)}
    />
  );

  return (
    <div className="sketch-colors" role="group" aria-label={t("Patient:MedRecord:Colors")}>
      <div className="sketch-colors-pair">
        {circle("color", color, t("Patient:MedRecord:Color1"))}
        {circle("fill", fill, t("Patient:MedRecord:Color2"))}
      </div>
      <div className="sketch-colors-grid">
        {[...SKETCH_COLORS, ...custom].map((value, at) => (
          <button
            key={`${value}-${at}`}
            type="button"
            className={["sketch-swatch", current === value && "sketch-swatch--active"].filter(Boolean).join(" ")}
            style={swatchStyle(value)}
            aria-label={value}
            title={value}
            onClick={() => onPick(slot, value)}
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
        defaultValue={current}
      />
    </div>
  );
}
