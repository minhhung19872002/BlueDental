import { useState } from "react";
import { Popover, Tooltip } from "antd";
import {
  ArrowUpFromLine,
  Contrast,
  Minus,
  PencilLine,
  Plus,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { ViewerAnnotation } from "../../../hooks/useViewerAnnotation";
import { PenPalette } from "../image/ViewerPenTools";
import { ZOOM, type ConsultingLibrary } from "./useConsultingLibrary";

interface Props {
  library: ConsultingLibrary;
  annotation: ViewerAnnotation;
  drawing: boolean;
  onToggleDrawing: () => void;
  /** Where the sheet rests when "Đặt lại" is pressed: 125% in the dialog, 75% full-screen. */
  restZoom: number;
  /** Full-screen with the content tray folded: the round button that brings it back. */
  onOpenTray?: () => void;
}

interface ToolProps {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  /** The red "Tắt chế độ vẽ" cross. */
  danger?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Tooltips and the palette must open inside the dialog, which sits above the
 * page's own popup layer; a popup left in `body` would be hidden behind it.
 */
/**
 * The palette opens without antd's zoom: mounted inside the library (not the
 * body), the trigger re-measures the popup while it is still scaled and lands
 * it a couple of hundred pixels off the pen.
 */
const NO_MOTION = { motionName: "" };

function popupContainerOf(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>(".pd-lib") ?? document.body;
}

function Tool({ label, disabled, pressed, danger, onClick, children }: ToolProps) {
  return (
    <Tooltip title={label} getPopupContainer={popupContainerOf}>
      <button
        type="button"
        className={["pd-lib-tool", danger && "pd-lib-tool--danger"].filter(Boolean).join(" ")}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * The floating pill at the foot of the sheet: zoom out, the percentage, zoom
 * in, reset; the X-ray inversion; the pen with its palette, and undo.
 *
 * The pen works as the reference's does: the first press turns drawing on
 * and shows the palette; while drawing it stays lit and reopens the palette,
 * whose "Tắt chế độ vẽ" is the way out.
 */
export function ConsultingLibraryToolbar({
  library,
  annotation,
  drawing,
  onToggleDrawing,
  restZoom,
  onOpenTray,
}: Props) {
  const { zoom, setZoom, inverted, toggleInverted } = library;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const invertLabel = inverted
    ? t("Khôi phục độ tương phản phim X-quang")
    : t("Đảo độ tương phản phim X-quang");
  const penLabel = drawing ? t("Đổi màu hoặc độ dày nét vẽ") : t("Bật chế độ vẽ");

  const handlePen = () => {
    if (drawing) return; // the popover's own click trigger toggles the palette
    onToggleDrawing();
    setPaletteOpen(true);
  };
  const handleExitDrawing = () => {
    setPaletteOpen(false);
    onToggleDrawing();
  };

  return (
    <div className="pd-lib-toolbar" role="toolbar" aria-label={t("Công cụ xem")}>
      <Tool
        label={t("Thu nhỏ ảnh")}
        disabled={zoom <= ZOOM.min}
        onClick={() => setZoom((value) => Math.max(ZOOM.min, value - ZOOM.step))}
      >
        <Minus size={16} />
      </Tool>
      <span className="pd-lib-toolbar__zoom">{zoom}%</span>
      <Tool
        label={t("Phóng to ảnh")}
        disabled={zoom >= ZOOM.max}
        onClick={() => setZoom((value) => Math.min(ZOOM.max, value + ZOOM.step))}
      >
        <Plus size={16} />
      </Tool>
      <Tool label={t("Đặt lại kích thước ảnh")} onClick={() => setZoom(() => restZoom)}>
        <RotateCcw size={16} />
      </Tool>
      <span className="pd-lib-toolbar__divider" />
      <Tool label={invertLabel} pressed={inverted} onClick={toggleInverted}>
        <Contrast size={16} />
      </Tool>
      <span className="pd-lib-toolbar__divider" />
      <Popover
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        content={<PenPalette annotation={annotation} onExit={handleExitDrawing} />}
        trigger="click"
        placement="top"
        rootClassName="pi-pen-popover"
        getPopupContainer={popupContainerOf}
        motion={NO_MOTION}
      >
        <span className="pd-lib-tool-wrap">
          <Tool label={penLabel} pressed={drawing} onClick={handlePen}>
            <PencilLine size={16} />
          </Tool>
        </span>
      </Popover>
      {drawing && !paletteOpen && (
        <Tool label={t("Tắt chế độ vẽ")} danger onClick={handleExitDrawing}>
          <X size={16} />
        </Tool>
      )}
      <Tool label={t("Hoàn tác nét vẽ")} disabled={!annotation.canUndo} onClick={annotation.undo}>
        <Undo2 size={16} />
      </Tool>
      {onOpenTray && (
        <span className="pd-lib-toolbar__tray">
          <Tooltip title={t("Mở danh sách nội dung tư vấn")} getPopupContainer={popupContainerOf}>
            <button
              type="button"
              className="pd-lib-tray-open"
              aria-label={t("Mở danh sách nội dung tư vấn")}
              onClick={onOpenTray}
            >
              <ArrowUpFromLine size={20} />
            </button>
          </Tooltip>
        </span>
      )}
    </div>
  );
}
