import { useState, type CSSProperties } from "react";
import { Slider } from "antd";
import { PencilLine, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { SIZE_RANGE, SKETCH_HEIGHT, SKETCH_WIDTH, type Item } from "./sketch";
import { boundsOf } from "./sketchPaint";

interface Props {
  item: Item;
  onResize: (size: number) => void;
  onEditText: () => void;
  onDelete: () => void;
}

/**
 * What can be done to the item picked out with the select tool, on a small bar
 * under it: a stroke or shape can be made thicker or thinner, words opened for
 * typing again, and either deleted. Moving is a drag; recolouring is a click
 * on the colour box.
 */
export function SketchSelectionBar({ item, onResize, onEditText, onDelete }: Props) {
  const [size, setSize] = useState(item.kind === "text" ? 0 : item.size);
  const box = boundsOf(item);
  const below = (box.y + box.height) / SKETCH_HEIGHT < 0.82;
  const range = item.kind === "stroke" ? SIZE_RANGE[item.tool] : SIZE_RANGE.shape;

  return (
    <div
      className={`sketch-selection-bar sketch-selection-bar--${below ? "below" : "above"}`}
      role="toolbar"
      aria-label={t("Patient:MedRecord:Selection")}
      style={
        {
          "--sel-x": (box.x + box.width / 2) / SKETCH_WIDTH,
          "--sel-top": box.y / SKETCH_HEIGHT,
          "--sel-bottom": (box.y + box.height) / SKETCH_HEIGHT,
        } as CSSProperties
      }
    >
      {item.kind === "text" ? (
        <button type="button" className="sketch-selection-btn" onClick={onEditText}>
          <PencilLine size={14} />
          {t("Patient:MedRecord:EditText")}
        </button>
      ) : (
        <Slider
          className="sketch-selection-size"
          min={range.min}
          max={range.max}
          value={size}
          onChange={setSize}
          onChangeComplete={onResize}
          aria-label={t("Patient:MedRecord:StrokeSize")}
          tooltip={{ formatter: (value) => `${value}px` }}
        />
      )}
      <button
        type="button"
        className="sketch-selection-btn sketch-selection-btn--danger"
        aria-label={t("Patient:MedRecord:DeleteSelection")}
        title={`${t("Patient:MedRecord:DeleteSelection")} (Delete)`}
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
