import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n";
import { useImageViewer } from "../../../hooks/useImageViewer";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { ViewerAnnotationLayer } from "./ViewerAnnotationLayer";
import { ViewerThumbStrip } from "./ViewerThumbStrip";
import { ViewerToolbar } from "./ViewerToolbar";

interface Props {
  /** Every image on the timeline, in the order it is shown. */
  images: PatientImageViewModel[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * The full-screen viewer behind the eye button: black backdrop, the picture
 * centred with zoom / rotate / flip applied, arrows either side, the file
 * name under it, a "1 / N" counter, and the thumbnail strip along the foot.
 * Rendered into `body` so no panel's overflow can clip it.
 */
export function PatientImageViewer({ images, initialIndex, onClose }: Props) {
  const viewer = useImageViewer(images.length, initialIndex, onClose);
  const closeRef = useRef<HTMLDivElement>(null);
  const image = images[viewer.index];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!image) return null;

  const { zoom, rotate, flipX, flipY } = viewer.transform;
  const frameStyle = {
    "--pi-zoom": zoom,
    "--pi-rotate": `${rotate}deg`,
    "--pi-flip-x": flipX ? -1 : 1,
    "--pi-flip-y": flipY ? -1 : 1,
  } as CSSProperties;

  return createPortal(
    <div
      ref={closeRef}
      className="pi-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t("Xem ảnh")}
      tabIndex={-1}
      data-testid="patient-image-viewer"
    >
      <div className="pi-viewer-top">
        <span className="pi-viewer-counter" data-testid="patient-image-counter">
          {viewer.index + 1} / {images.length}
        </span>
        <ViewerToolbar viewer={viewer} onClose={onClose} />
      </div>

      <div className="pi-viewer-stage">
        <button type="button" className="pi-viewer-nav pi-viewer-nav--prev" aria-label={t("Ảnh trước")} onClick={viewer.prev}>
          <ArrowLeft size={24} />
        </button>
        <div className="pi-viewer-frame" style={frameStyle}>
          <img src={image.url} alt={image.fileName} draggable={false} />
        </div>
        <ViewerAnnotationLayer key={image.id} active={viewer.drawing} onExit={viewer.toggleDrawing} />
        <button type="button" className="pi-viewer-nav pi-viewer-nav--next" aria-label={t("Ảnh sau")} onClick={viewer.next}>
          <ArrowRight size={24} />
        </button>
      </div>

      <p className="pi-viewer-caption" role="status" aria-live="polite">
        {image.fileName}
      </p>
      <ViewerThumbStrip images={images} index={viewer.index} onSelect={viewer.goTo} />
    </div>,
    document.body,
  );
}
