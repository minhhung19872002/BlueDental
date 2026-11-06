import type { CSSProperties } from "react";
import { BgColorsOutlined } from "@ant-design/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { LabelBadge } from "./LabelBadge";
import { LABEL_COLOR_DEFAULT, LABEL_COLOR_PRESETS } from "./labelColor";
import "./label-color.css";

interface LabelColorPickerProps {
  /** Injected by Form.Item: "#RRGGBB", or null for the default grey. */
  value?: string | null;
  onChange?: (color: string | null) => void;
  title: string;
  /** What the preview badge reads — the name being typed. */
  previewText: string;
  /** What "Mặc định" (null) draws; grey unless the record has its own default (staff, R-1155). */
  defaultColor?: string;
  /** The name of the "Mặc định" swatch, which says its colour; "Mặc định (xám)" unless given. */
  defaultLabel?: string;
}

const swatchColor = (color: string) => ({ "--bd-label-color": color }) as CSSProperties;

/**
 * Mặc định, eight presets and a custom picker, with a preview badge under
 * them. A controlled Form.Item child, so the colour travels with the rest of
 * the form (R-1072).
 */
export function LabelColorPicker({
  value = null,
  onChange,
  title,
  previewText,
  defaultColor = LABEL_COLOR_DEFAULT,
  defaultLabel = t("Common:LabelColor:Default"),
}: LabelColorPickerProps) {
  const picked = value?.toUpperCase() ?? null;
  const isCustom = picked !== null && !LABEL_COLOR_PRESETS.some((preset) => preset === picked);

  return (
    <div className="bd-dialog-section">
      <p className="bd-dialog-section-title">{title}</p>
      <div role="radiogroup" aria-label={title} className="bd-label-swatches">
        <button
          type="button"
          role="radio"
          aria-checked={picked === null}
          aria-label={defaultLabel}
          title={defaultLabel}
          onClick={() => onChange?.(null)}
          style={swatchColor(defaultColor)}
          className={cn("bd-label-swatch", picked === null && "bd-label-swatch--picked")}
        />
        {LABEL_COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={picked === preset}
            aria-label={t("Common:LabelColor:Select", preset)}
            onClick={() => onChange?.(preset)}
            style={swatchColor(preset)}
            className={cn("bd-label-swatch", picked === preset && "bd-label-swatch--picked")}
          />
        ))}
        <span
          className={cn("bd-label-swatch bd-label-swatch--custom", isCustom && "bd-label-swatch--picked")}
          style={isCustom ? swatchColor(picked) : undefined}
        >
          {!isCustom && <BgColorsOutlined aria-hidden="true" />}
          <input
            type="color"
            aria-label={t("Common:LabelColor:Custom")}
            value={picked ?? defaultColor}
            onChange={(event) => onChange?.(event.target.value.toUpperCase())}
            className="bd-color-input"
          />
        </span>
      </div>

      <div className="bd-label-preview">
        <span className="bd-cat-hint">{t("Common:LabelColor:Preview")}</span>
        <LabelBadge color={picked ?? defaultColor}>{previewText.trim() || title}</LabelBadge>
      </div>
    </div>
  );
}
