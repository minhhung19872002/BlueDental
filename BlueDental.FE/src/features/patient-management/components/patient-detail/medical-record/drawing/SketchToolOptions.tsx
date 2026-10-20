import type { CSSProperties } from "react";
import { Slider } from "antd";
import { Circle, Minus, MoveUpRight, Square, type LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import { SIZE_RANGE, type ShapeKind, type SizedTool, type SketchSettings } from "./sketch";

const SHAPES: ReadonlyArray<{ kind: ShapeKind; icon: LucideIcon; label: string }> = [
  { kind: "line", icon: Minus, label: "Patient:MedRecord:ShapeLine" },
  { kind: "arrow", icon: MoveUpRight, label: "Patient:MedRecord:ShapeArrow" },
  { kind: "rect", icon: Square, label: "Patient:MedRecord:ShapeRect" },
  { kind: "ellipse", icon: Circle, label: "Patient:MedRecord:ShapeEllipse" },
];

interface Props {
  tool: SizedTool;
  settings: SketchSettings;
  onChange: (next: SketchSettings) => void;
}

/**
 * The panel under a tool's arrow: which shape, for the shape tool, and how
 * thick. The colour is not here — it is the one colour box every tool shares.
 */
export function SketchToolOptions({ tool, settings, onChange }: Props) {
  const range = SIZE_RANGE[tool];

  return (
    <div className="sketch-options">
      {tool === "shape" && (
        <div className="sketch-options-shapes" role="radiogroup" aria-label={t("Patient:MedRecord:Shapes")}>
          {SHAPES.map(({ kind, icon: Icon, label }) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={settings.shape === kind}
              aria-label={t(label)}
              title={t(label)}
              className={["sketch-shape", settings.shape === kind && "sketch-shape--active"].filter(Boolean).join(" ")}
              onClick={() => onChange({ ...settings, shape: kind })}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      )}

      <SizeSlider
        size={settings.sizes[tool]}
        min={range.min}
        max={range.max}
        color={tool === "eraser" ? undefined : settings.color}
        translucent={tool === "highlighter"}
        onChange={(size) => onChange({ ...settings, sizes: { ...settings.sizes, [tool]: size } })}
      />
    </div>
  );
}

interface SizeSliderProps {
  size: number;
  min: number;
  max: number;
  /** The sample line's colour; the eraser has none and shows grey. */
  color?: string;
  translucent?: boolean;
  onChange: (size: number) => void;
  /** Called once the knob is let go, for a change that becomes a step of undo. */
  onChangeComplete?: (size: number) => void;
}

export function SizeSlider({ size, min, max, color, translucent, onChange, onChangeComplete }: SizeSliderProps) {
  const sample = { "--sample-color": color ?? "#94a3b8", "--sample-size": Math.min(size, 40) } as CSSProperties;

  return (
    <>
      <p className="sketch-options-label">{t("Patient:MedRecord:StrokeSize")}</p>
      <svg className="sketch-size-sample" viewBox="0 0 240 48" aria-hidden="true">
        <path
          d="M14 34 C 70 6, 110 46, 160 24 S 220 10, 226 16"
          className={translucent ? "sketch-size-path sketch-size-path--translucent" : "sketch-size-path"}
          style={sample}
        />
      </svg>
      <Slider
        min={min}
        max={max}
        value={size}
        onChange={onChange}
        onChangeComplete={onChangeComplete}
        aria-label={t("Patient:MedRecord:StrokeSize")}
        tooltip={{ formatter: (value) => `${value}px` }}
      />
    </>
  );
}
