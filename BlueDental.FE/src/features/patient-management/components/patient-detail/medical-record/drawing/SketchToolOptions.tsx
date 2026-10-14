import type { CSSProperties } from "react";
import { Slider } from "antd";
import { Circle, Minus, MoveUpRight, Square, type LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import { SIZE_RANGE, SKETCH_COLORS, type ShapeKind, type SketchSettings, type SketchTool } from "./sketch";

const SHAPES: ReadonlyArray<{ kind: ShapeKind; icon: LucideIcon; label: string }> = [
  { kind: "line", icon: Minus, label: "Patient:MedRecord:ShapeLine" },
  { kind: "arrow", icon: MoveUpRight, label: "Patient:MedRecord:ShapeArrow" },
  { kind: "rect", icon: Square, label: "Patient:MedRecord:ShapeRect" },
  { kind: "ellipse", icon: Circle, label: "Patient:MedRecord:ShapeEllipse" },
];

interface Props {
  tool: SketchTool;
  settings: SketchSettings;
  onChange: (next: SketchSettings) => void;
}

/** The style a tool draws with — the key it is kept under in the settings. */
const STYLE_KEY = { pen: "pen", highlighter: "highlighter", shape: "shapeStyle" } as const;

/**
 * The panel under a tool's arrow, laid out as Snipping Tool lays it out: the
 * shapes (for the shape tool), "Màu" as a grid of thirty, and "Cỡ nét" as a
 * slider over a sample of the line it will draw.
 */
export function SketchToolOptions({ tool, settings, onChange }: Props) {
  const range = SIZE_RANGE[tool];

  if (tool === "eraser") {
    return (
      <div className="sketch-options">
        <SizeSlider
          size={settings.eraser.size}
          min={range.min}
          max={range.max}
          onChange={(size) => onChange({ ...settings, eraser: { size } })}
        />
      </div>
    );
  }

  const key = STYLE_KEY[tool];
  const style = settings[key];
  const setStyle = (patch: Partial<typeof style>) =>
    onChange({ ...settings, [key]: { ...style, ...patch } });

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

      <p className="sketch-options-label">{t("Patient:MedRecord:Colors")}</p>
      <div className="sketch-swatches" role="radiogroup" aria-label={t("Patient:MedRecord:Colors")}>
        {SKETCH_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={style.color === color}
            aria-label={color}
            className={["sketch-swatch", style.color === color && "sketch-swatch--active"].filter(Boolean).join(" ")}
            style={{ "--swatch": color } as CSSProperties}
            onClick={() => setStyle({ color })}
          />
        ))}
      </div>

      <SizeSlider
        size={style.size}
        min={range.min}
        max={range.max}
        color={style.color}
        translucent={tool === "highlighter"}
        onChange={(size) => setStyle({ size })}
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
}

function SizeSlider({ size, min, max, color, translucent, onChange }: SizeSliderProps) {
  return (
    <>
      <p className="sketch-options-label">{t("Patient:MedRecord:StrokeSize")}</p>
      <svg className="sketch-size-sample" viewBox="0 0 240 48" aria-hidden="true">
        <path
          d="M14 34 C 70 6, 110 46, 160 24 S 220 10, 226 16"
          className={translucent ? "sketch-size-path sketch-size-path--translucent" : "sketch-size-path"}
          style={{ "--sample-color": color ?? "#94a3b8", "--sample-size": Math.min(size, 40) } as CSSProperties}
        />
      </svg>
      <Slider
        min={min}
        max={max}
        value={size}
        onChange={onChange}
        aria-label={t("Patient:MedRecord:StrokeSize")}
        tooltip={{ formatter: (value) => `${value}px` }}
      />
    </>
  );
}
