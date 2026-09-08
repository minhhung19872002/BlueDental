import type { CSSProperties } from "react";
import { Popover, Tooltip } from "antd";
import { Check, Palette, PenOff, Undo2 } from "lucide-react";
import { t } from "@/lib/i18n";
import {
  PEN_COLORS,
  PEN_SIZE_OPTIONS,
  type ViewerAnnotation,
} from "../../../hooks/useViewerAnnotation";

interface PaletteProps {
  annotation: ViewerAnnotation;
  /** "Tắt chế độ vẽ" at the foot of the palette; left out where the bar has its own. */
  onExit?: () => void;
}

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

/**
 * "Màu bút" and "Độ dày nét", laid out as the reference's pen popover: six
 * round swatches with a free pick after them, three thickness buttons each
 * showing its own dot, and the way out of drawing mode.
 */
export function PenPalette({ annotation, onExit }: PaletteProps) {
  const { color, size, setColor, setSize } = annotation;
  const isCustomColor = !PEN_COLORS.includes(color);

  return (
    <div className="pi-pen-palette">
      <section>
        <h4 className="pi-pen-palette__title">{t("Màu bút")}</h4>
        <div className="pi-pen-colors">
          {PEN_COLORS.map((swatch) => {
            const active = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                className={["pi-pen-swatch", active && "pi-pen-swatch--active"]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--pi-swatch": swatch } as CSSProperties}
                aria-label={`${t("Chọn màu")} ${swatch}`}
                aria-pressed={active}
                onClick={() => setColor(swatch)}
              >
                {active && <Check size={14} />}
              </button>
            );
          })}
          <label
            className={[
              "pi-pen-swatch",
              "pi-pen-swatch--custom",
              isCustomColor && "pi-pen-swatch--active",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--pi-swatch": isCustomColor ? color : "transparent" } as CSSProperties}
          >
            <input
              type="color"
              aria-label={t("Chọn màu tuỳ chỉnh")}
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section>
        <h4 className="pi-pen-palette__title">{t("Độ dày nét")}</h4>
        <div className="pi-pen-sizes">
          {PEN_SIZE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={["pi-pen-size", option === size && "pi-pen-size--active"]
                .filter(Boolean)
                .join(" ")}
              style={{ "--pi-dot": `${option}px` } as CSSProperties}
              aria-label={`${t("Chọn độ dày")} ${option}`}
              aria-pressed={option === size}
              onClick={() => setSize(option)}
            >
              <span className="pi-pen-size__dot" />
            </button>
          ))}
        </div>
      </section>

      {onExit && (
        <button type="button" className="pi-pen-palette__exit" onClick={onExit}>
          {t("Tắt chế độ vẽ")}
        </button>
      )}
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
      <Popover
        content={<PenPalette annotation={annotation} />}
        trigger="click"
        placement="bottom"
        rootClassName="pi-pen-popover"
        getPopupContainer={popupContainerOf}
      >
        <Tooltip title={t("Đổi màu hoặc độ dày nét vẽ")}>
          <button
            type="button"
            className="pi-pen-tool"
            aria-label={t("Đổi màu hoặc độ dày nét vẽ")}
          >
            <Palette size={18} />
          </button>
        </Tooltip>
      </Popover>
      <Tooltip title={t("Hoàn tác nét vẽ")}>
        <button
          type="button"
          className="pi-pen-tool"
          aria-label={t("Hoàn tác nét vẽ")}
          disabled={!annotation.canUndo}
          onClick={annotation.undo}
        >
          <Undo2 size={18} />
        </button>
      </Tooltip>
      <Tooltip title={t("Tắt chế độ vẽ")}>
        <button
          type="button"
          className="pi-pen-tool"
          aria-label={t("Tắt chế độ vẽ")}
          onClick={handleExit}
        >
          <PenOff size={18} />
        </button>
      </Tooltip>
    </div>
  );
}
