import type { MouseEvent } from "react";
import { Select } from "antd";
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
  /** The look at the caret while words are typed, else what the next box types in. */
  style: TextStyle;
  /** Only what was changed: it lands on the highlighted words, not on all of them. */
  onChange: (patch: Partial<TextStyle>) => void;
}

/**
 * Paint's text bar, docked above the page while the text tool is in use:
 * font, size, bold / italic / underline / strike-through and alignment.
 */
export function SketchTextToolbar({ style, onChange }: Props) {
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
    <div className="sketch-text-bar" role="toolbar" aria-label={t("Patient:MedRecord:TextFormat")}>
      <Select
        size="small"
        className="sketch-text-font"
        value={style.font}
        options={FONT_OPTIONS}
        aria-label={t("Patient:MedRecord:Font")}
        onChange={(font) => onChange({ font })}
      />
      <Select
        size="small"
        className="sketch-text-size"
        value={style.points}
        options={SIZE_OPTIONS}
        aria-label={t("Patient:MedRecord:FontSize")}
        onChange={(points) => onChange({ points })}
      />
      <span className="sketch-text-sep" />
      {TOGGLES.map(({ key, icon, label }) => toggle(key, style[key], icon, label, () => onChange({ [key]: !style[key] })))}
      <span className="sketch-text-sep" />
      {ALIGNS.map(({ key, icon, label }) => toggle(key, style.align === key, icon, label, () => onChange({ align: key })))}
    </div>
  );
}
