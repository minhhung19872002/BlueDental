import type { CSSProperties, MouseEvent } from "react";
import { Checkbox, Select } from "antd";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { SKETCH_FONTS, SKETCH_POINT_SIZES, type TextAlign, type TextStyle } from "./sketch";

type Toggle = "bold" | "italic" | "underline" | "strike";

const TOGGLES: ReadonlyArray<{ key: Toggle; icon: LucideIcon; label: string }> = [
  { key: "bold", icon: Bold, label: "Patient:MedRecord:Bold" },
  { key: "italic", icon: Italic, label: "Patient:MedRecord:Italic" },
  { key: "underline", icon: Underline, label: "Patient:MedRecord:Underline" },
  { key: "strike", icon: Strikethrough, label: "Patient:MedRecord:Strike" },
];

const ALIGNS: ReadonlyArray<{ key: TextAlign; icon: LucideIcon; label: string }> = [
  { key: "left", icon: AlignLeft, label: "Patient:MedRecord:AlignLeft" },
  { key: "center", icon: AlignCenter, label: "Patient:MedRecord:AlignCenter" },
  { key: "right", icon: AlignRight, label: "Patient:MedRecord:AlignRight" },
];

const FONT_OPTIONS = SKETCH_FONTS.map((font) => ({ value: font, label: font }));
const SIZE_OPTIONS = SKETCH_POINT_SIZES.map((size) => ({ value: size, label: String(size) }));

/** A press on a button here must not take the caret out of the words being typed. */
const keepCaret = (event: MouseEvent) => event.preventDefault();

interface Props {
  style: TextStyle;
  /** Where the box being typed into is, as fractions of the page. */
  at: { x: number; y: number };
  onChange: (next: TextStyle) => void;
  /** Puts the caret back in the words after a list has taken it. */
  onRefocus: () => void;
}

/**
 * Paint's text bar, floating over the page while words are typed: font, size,
 * bold / italic / underline / strike-through, alignment and "Tô nền". It sits
 * above the box, or below it when the box is near the top of the page.
 */
export function SketchTextToolbar({ style, at, onChange, onRefocus }: Props) {
  const set = (patch: Partial<TextStyle>) => onChange({ ...style, ...patch });
  const placement = at.y < 0.15 ? "below" : "above";

  const toggle = (key: string, active: boolean, Icon: LucideIcon, label: string, onToggle: () => void) => (
    <button
      key={key}
      type="button"
      className={["sketch-text-btn", active && "sketch-text-btn--active"].filter(Boolean).join(" ")}
      aria-pressed={active}
      aria-label={t(label)}
      title={t(label)}
      onMouseDown={keepCaret}
      onClick={onToggle}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div
      className={`sketch-text-bar sketch-text-bar--${placement}`}
      role="toolbar"
      aria-label={t("Patient:MedRecord:TextFormat")}
      style={{ "--bar-x": at.x, "--bar-y": at.y } as CSSProperties}
    >
      <Select
        size="small"
        className="sketch-text-font"
        value={style.font}
        options={FONT_OPTIONS}
        aria-label={t("Patient:MedRecord:Font")}
        onChange={(font) => {
          set({ font });
          onRefocus();
        }}
      />
      <Select
        size="small"
        className="sketch-text-size"
        value={style.points}
        options={SIZE_OPTIONS}
        aria-label={t("Patient:MedRecord:FontSize")}
        onChange={(points) => {
          set({ points });
          onRefocus();
        }}
      />
      <span className="sketch-text-sep" />
      {TOGGLES.map(({ key, icon, label }) => toggle(key, style[key], icon, label, () => set({ [key]: !style[key] })))}
      <span className="sketch-text-sep" />
      {ALIGNS.map(({ key, icon, label }) => toggle(key, style.align === key, icon, label, () => set({ align: key })))}
      <span className="sketch-text-sep" />
      <span className="sketch-text-fill" onMouseDown={keepCaret}>
        <Checkbox
          checked={style.filled}
          onChange={(event) => {
            set({ filled: event.target.checked });
            onRefocus();
          }}
        >
          {t("Patient:MedRecord:TextFill")}
        </Checkbox>
      </span>
    </div>
  );
}
