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
  onClick?: () => void;
  children: React.ReactNode;
}

function Tool({ label, disabled, pressed, onClick, children }: ToolProps) {
  return (
    <Tooltip title={label}>
      <button
        type="button"
        className="pd-lib-tool"
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

/** The popover must open inside the dialog, which sits above the page's own popup layer. */
function popupContainerOf(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>(".pd-lib") ?? document.body;
}

/**
 * The floating pill at the foot of the sheet: zoom out, the percentage, zoom
 * in, reset; the X-ray inversion; the pen with its palette, and undo.
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
  const invertLabel = inverted
    ? t("Khôi phục độ tương phản phim X-quang")
    : t("Đảo độ tương phản phim X-quang");

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
      {drawing ? (
        <Tool label={t("Tắt chế độ vẽ")} pressed onClick={onToggleDrawing}>
          <X size={16} className="pd-lib-tool__danger" />
        </Tool>
      ) : (
        <Popover
          content={<PenPalette annotation={annotation} />}
          trigger="click"
          placement="top"
          getPopupContainer={popupContainerOf}
        >
          <span className="pd-lib-tool-wrap">
            <Tool label={t("Bật chế độ vẽ")} onClick={onToggleDrawing}>
              <PencilLine size={16} />
            </Tool>
          </span>
        </Popover>
      )}
      <Tool label={t("Hoàn tác nét vẽ")} disabled={!annotation.canUndo} onClick={annotation.undo}>
        <Undo2 size={16} />
      </Tool>
      {onOpenTray && (
        <span className="pd-lib-toolbar__tray">
          <Tooltip title={t("Mở danh sách nội dung tư vấn")}>
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
