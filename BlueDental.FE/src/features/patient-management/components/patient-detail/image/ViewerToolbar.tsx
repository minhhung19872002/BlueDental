import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  PenLine,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { ImageViewer } from "../../../hooks/useImageViewer";

interface Props {
  viewer: ImageViewer;
  onClose: () => void;
}

interface Tool {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

/** The reference's buttons, left to right. */
function tools(viewer: ImageViewer, onClose: () => void): Tool[] {
  return [
    { key: "draw", label: t("Patient:Viewer:DrawAnnotation"), icon: <PenLine size={20} />, onClick: viewer.toggleDrawing, active: viewer.drawing },
    { key: "rotate-right", label: t("Patient:Viewer:RotateRight"), icon: <RotateCw size={20} />, onClick: viewer.rotateRight },
    { key: "rotate-left", label: t("Patient:Viewer:RotateLeft"), icon: <RotateCcw size={20} />, onClick: viewer.rotateLeft },
    { key: "flip-h", label: t("Patient:Viewer:FlipHorizontal"), icon: <ArrowLeftRight size={20} />, onClick: viewer.flipHorizontal },
    { key: "flip-v", label: t("Patient:Viewer:FlipVertical"), icon: <ArrowUpDown size={20} />, onClick: viewer.flipVertical },
    { key: "zoom-out", label: t("Zoom xa"), icon: <ZoomOut size={20} />, onClick: viewer.zoomOut, disabled: !viewer.canZoomOut },
    { key: "zoom-in", label: t("Patient:Viewer:ZoomClose"), icon: <ZoomIn size={20} />, onClick: viewer.zoomIn, disabled: !viewer.canZoomIn },
    { key: "close", label: t("Common:Close"), icon: <X size={22} />, onClick: onClose },
  ];
}

/** The row of white icons in the viewer's top-right corner. */
export function ViewerToolbar({ viewer, onClose }: Props) {
  return (
    <div className="pi-viewer-tools" role="toolbar" aria-label={t("Patient:Viewer:ImageTools")}>
      {tools(viewer, onClose).map((tool) => (
        <button
          key={tool.key}
          type="button"
          className={["pi-viewer-tool", tool.active && "pi-viewer-tool--active"].filter(Boolean).join(" ")}
          aria-label={tool.label}
          title={tool.label}
          aria-pressed={tool.active}
          disabled={tool.disabled}
          onClick={tool.onClick}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
