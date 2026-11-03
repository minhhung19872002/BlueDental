import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { t } from "@/lib/i18n";
import { useImageViewer, ZOOM_MAX, ZOOM_MIN } from "../../../hooks/useImageViewer";
import { useViewerAnnotation } from "../../../hooks/useViewerAnnotation";
import { useViewerPan } from "../../../hooks/useViewerPan";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { ViewerAnnotationCanvas } from "./ViewerAnnotationCanvas";
import { ViewerPenTools } from "./ViewerPenTools";
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
 * The wheel or two fingers zoom, a zoomed picture drags, a double-click zooms
 * in and back, and the annotation canvas rides inside the frame so strokes
 * follow it all.
 * A click on the black backdrop closes it, as lightGallery does on the
 * reference. Rendered into `body` so no panel's overflow can clip it.
 */

/** The parts of the viewer that are not backdrop: a click on them is theirs. */
const SOLID_PARTS = ".pi-viewer-frame, .pi-viewer-top, .pi-viewer-nav, .pi-pen-tools, .pi-viewer-thumbs, .ant-popover";

export function PatientImageViewer({ images, initialIndex, onClose }: Props) {
  const viewer = useImageViewer(images.length, initialIndex, onClose);
  const annotation = useViewerAnnotation();
  const closeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const image = images[viewer.index];
  const { zoom, rotate, flipX, flipY, pan } = viewer.transform;
  const pannable = zoom > 1 && !viewer.drawing;
  const drag = useViewerPan({ enabled: pannable, frameRef, pan, onPan: viewer.setPan, onWheel: viewer.zoomByWheel });

  // Anywhere on the stage, not only on the picture; the pen keeps its fingers.
  const pinchFrom = useRef({ zoom, pan });
  const [pinching, setPinching] = useState(false);
  usePinchZoom(stageRef, !viewer.drawing, {
    onPinchStart: () => {
      pinchFrom.current = { zoom, pan };
      setPinching(true);
    },
    onPinch: (scale) => {
      const from = pinchFrom.current;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, from.zoom * scale));
      const grow = next / from.zoom;
      viewer.pinchZoom(next, { x: from.pan.x * grow, y: from.pan.y * grow });
    },
    onPinchEnd: () => setPinching(false),
  });

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /** A drawing belongs to one picture: moving on wipes it. */
  const { clear } = annotation;
  useEffect(() => clear(), [clear, viewer.index]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest(SOLID_PARTS)) return;
    onClose();
  };

  if (!image) return null;

  const frameStyle = {
    "--pi-zoom": zoom,
    "--pi-rotate": `${rotate}deg`,
    "--pi-flip-x": flipX ? -1 : 1,
    "--pi-flip-y": flipY ? -1 : 1,
    "--pi-pan-x": `${pan.x}px`,
    "--pi-pan-y": `${pan.y}px`,
  } as CSSProperties;
  // Following the fingers, not easing after them: the drag's no-transition class.
  const following = drag.panning || pinching;
  const frameClass = ["pi-viewer-frame", pannable && "pi-viewer-frame--pannable", following && "pi-viewer-frame--panning"]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      ref={closeRef}
      className="pi-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t("Patient:Misc:ViewImage")}
      tabIndex={-1}
      data-testid="patient-image-viewer"
      onClick={handleBackdropClick}
    >
      <div className="pi-viewer-top">
        <span className="pi-viewer-counter" data-testid="patient-image-counter">
          {viewer.index + 1} / {images.length}
        </span>
        <ViewerToolbar viewer={viewer} onClose={onClose} />
      </div>

      <div ref={stageRef} className="pi-viewer-stage">
        <button type="button" className="pi-viewer-nav pi-viewer-nav--prev" aria-label={t("Patient:Photo:Before")} onClick={viewer.prev}>
          <ArrowLeft size={24} />
        </button>
        <div
          ref={frameRef}
          className={frameClass}
          style={frameStyle}
          data-testid="patient-image-frame"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerUp}
          onDoubleClick={viewer.drawing ? undefined : viewer.toggleZoom}
        >
          <img src={image.url} alt={image.fileName} draggable={false} />
          <ViewerAnnotationCanvas active={viewer.drawing} annotation={annotation} />
        </div>
        {viewer.drawing && <ViewerPenTools annotation={annotation} onExit={viewer.toggleDrawing} />}
        <button type="button" className="pi-viewer-nav pi-viewer-nav--next" aria-label={t("Patient:Photo:After")} onClick={viewer.next}>
          <ArrowRight size={24} />
        </button>
      </div>

      <p className="pi-viewer-caption" role="status" aria-live="polite">
        {image.fileName}
      </p>
      {image.note && <p className="pi-viewer-note">{image.note}</p>}
      <ViewerThumbStrip images={images} index={viewer.index} onSelect={viewer.goTo} />
    </div>,
    document.body,
  );
}
