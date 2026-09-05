import type { CSSProperties } from "react";
import { Popover, Tooltip } from "antd";
import { Palette, PenOff, Undo2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { PEN_COLORS, PEN_SIZES, type ViewerAnnotation } from "../../../hooks/useViewerAnnotation";

interface Props {
  annotation: ViewerAnnotation;
  onExit: () => void;
}

/**
 * The viewer sits above every other layer of the page, so a popup left in
 * `body` would be hidden behind it: the palette is mounted inside the viewer.
 */
function popupContainerOf(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>(".pi-viewer") ?? document.body;
}

function PenPalette({ annotation }: { annotation: ViewerAnnotation }) {
  const { color, size, setColor, setSize } = annotation;
  const isCustomColor = !PEN_COLORS.includes(color);
  return (
    <div className="pi-pen-palette">
      <div className="pi-pen-colors">
        {PEN_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={["pi-pen-swatch", swatch === color && "pi-pen-swatch--active"].filter(Boolean).join(" ")}
            style={{ "--pi-swatch": swatch } as CSSProperties}
            aria-label={swatch}
            aria-pressed={swatch === color}
            onClick={() => setColor(swatch)}
          />
        ))}
        <label
          className={["pi-pen-swatch", "pi-pen-swatch--custom", isCustomColor && "pi-pen-swatch--active"]
            .filter(Boolean)
            .join(" ")}
          style={{ "--pi-swatch": isCustomColor ? color : "transparent" } as CSSProperties}
        >
          <input type="color" aria-label={t("Màu tùy chọn")} value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
      </div>
      <label className="pi-pen-size">
        <span>{t("Độ dày")}</span>
        <input type="range" min={PEN_SIZES.min} max={PEN_SIZES.max} value={size} onChange={(event) => setSize(Number(event.target.value))} />
      </label>
    </div>
  );
}

/** The small round bar over the picture while the pen is out: palette, undo, put away. */
export function ViewerPenTools({ annotation, onExit }: Props) {
  /** Putting the pen away wipes the drawing, as the reference does. */
  const handleExit = () => {
    annotation.clear();
    onExit();
  };

  return (
    <div className="pi-pen-tools" role="toolbar" aria-label={t("Vẽ chú thích")}>
      <Popover content={<PenPalette annotation={annotation} />} trigger="click" placement="bottom" getPopupContainer={popupContainerOf}>
        <Tooltip title={t("Đổi màu hoặc độ dày nét vẽ")}>
          <button type="button" className="pi-pen-tool" aria-label={t("Đổi màu hoặc độ dày nét vẽ")}>
            <Palette size={18} />
          </button>
        </Tooltip>
      </Popover>
      <Tooltip title={t("Hoàn tác nét vẽ")}>
        <button type="button" className="pi-pen-tool" aria-label={t("Hoàn tác nét vẽ")} disabled={!annotation.canUndo} onClick={annotation.undo}>
          <Undo2 size={18} />
        </button>
      </Tooltip>
      <Tooltip title={t("Tắt chế độ vẽ")}>
        <button type="button" className="pi-pen-tool" aria-label={t("Tắt chế độ vẽ")} onClick={handleExit}>
          <PenOff size={18} />
        </button>
      </Tooltip>
    </div>
  );
}
