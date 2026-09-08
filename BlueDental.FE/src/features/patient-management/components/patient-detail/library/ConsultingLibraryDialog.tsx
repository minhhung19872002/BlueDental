import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Expand, ListCollapse, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useViewerAnnotation } from "../../../hooks/useViewerAnnotation";
import { ConsultingContentStrip } from "./ConsultingContentStrip";
import { ConsultingLibrarySheet } from "./ConsultingLibrarySheet";
import { ConsultingLibraryToolbar } from "./ConsultingLibraryToolbar";
import { ConsultingTopicAside } from "./ConsultingTopicAside";
import { useConsultingLibrary, ZOOM } from "./useConsultingLibrary";
import "./consulting-library.css";

interface Props {
  open: boolean;
  branchId: string | undefined;
  imageCount: number;
  onClose: () => void;
}

/** The header dot cycles nine tints by topic position; red while there is no topic. */
const DOT_TONES = 9;

/**
 * "Thư viện ảnh lâm sàng" — what the Danh mục button of Chẩn đoán & Tư vấn
 * opens: the consulting topics down the left, the chosen content's write-up
 * on a sheet, and its siblings as chips underneath. "Toàn màn hình" folds the
 * side panels into floating trays over the sheet.
 */
export function ConsultingLibraryDialog({ open, branchId, imageCount, onClose }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [asideOpen, setAsideOpen] = useState(true);
  const [trayOpen, setTrayOpen] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const library = useConsultingLibrary(open ? branchId : undefined, fullscreen);
  const annotation = useViewerAnnotation();

  // Escape leaves full-screen first, then the dialog — as the reference does.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (fullscreen) setFullscreen(false);
      else onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, fullscreen, onClose]);

  /** A drawing belongs to one content or photograph: moving on wipes it. */
  const { clear } = annotation;
  useEffect(() => clear(), [clear, library.content?.id, imageIndex]);

  if (!open) return null;

  const stepImage = (delta: number) =>
    setImageIndex((index) => (imageCount ? (index + delta + imageCount) % imageCount : 0));
  const toggleDrawing = () => {
    if (drawing) clear();
    setDrawing((value) => !value);
  };
  const dotTone = library.topic ? library.topicIndex % DOT_TONES : "none";
  const badge = library.content ? `${library.contentIndex + 1}/${library.contents.length}` : "0/0";
  const shellClass = ["pd-lib", fullscreen && "pd-lib--full"].filter(Boolean).join(" ");
  const sheet = (
    <ConsultingLibrarySheet
      library={library}
      annotation={annotation}
      drawing={drawing}
      imageCount={imageCount}
      onStep={stepImage}
    />
  );
  const toolbar = (
    <ConsultingLibraryToolbar
      library={library}
      annotation={annotation}
      drawing={drawing}
      onToggleDrawing={toggleDrawing}
      restZoom={fullscreen ? ZOOM.fullscreen : ZOOM.dialog}
      onOpenTray={fullscreen && !trayOpen ? () => setTrayOpen(true) : undefined}
    />
  );

  return createPortal(
    <div className="pd-lib-backdrop">
      <section
        className={shellClass}
        role="dialog"
        aria-modal="true"
        aria-label={
          fullscreen ? t("Thư viện ảnh lâm sàng toàn màn hình") : t("Thư viện ảnh lâm sàng")
        }
      >
        {fullscreen ? (
          <main
            className={["pd-lib-full", !trayOpen && "pd-lib-full--tray-closed"]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["pd-lib-float pd-lib-float--aside", !asideOpen && "pd-lib-float--closed"]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="pd-lib-float__btn"
                aria-label={t("Mở danh mục ảnh")}
                onClick={() => setAsideOpen(true)}
              >
                <ListCollapse size={20} />
              </button>
              <ConsultingTopicAside library={library} onCollapse={() => setAsideOpen(false)} />
            </div>
            <div
              className={["pd-lib-float pd-lib-float--tray", !trayOpen && "pd-lib-float--closed"]
                .filter(Boolean)
                .join(" ")}
            >
              <ConsultingContentStrip library={library} onCollapse={() => setTrayOpen(false)} />
            </div>
            <button type="button" className="pd-lib-exit" onClick={() => setFullscreen(false)}>
              <X size={16} />
              {t("Thoát")}
            </button>
            {sheet}
            {toolbar}
          </main>
        ) : (
          <>
            <ConsultingTopicAside library={library} />
            <main className="pd-lib-main">
              <header className="pd-lib-head">
                <span className="pd-lib-dot" data-tone={dotTone} />
                <strong className="pd-lib-head__topic">
                  {library.topic?.name ?? t("Dữ liệu tư vấn")}
                </strong>
                <ChevronRight size={16} className="pd-lib-head__sep" />
                <span className="pd-lib-head__content">
                  {library.content?.name ?? t("Dữ liệu tư vấn")}
                </span>
                <span className="pd-lib-count pd-lib-count--head">{badge}</span>
                <button
                  type="button"
                  className="tp-btn tp-btn--outline pd-lib-head__full"
                  onClick={() => setFullscreen(true)}
                >
                  <Expand size={16} />
                  {t("Toàn màn hình")}
                </button>
                <button
                  type="button"
                  className="pd-lib-icon-btn pd-lib-icon-btn--close"
                  aria-label={t("Đóng thư viện ảnh")}
                  onClick={onClose}
                >
                  <X size={18} />
                </button>
              </header>
              <div className="pd-lib-stage">
                {sheet}
                {toolbar}
              </div>
              <ConsultingContentStrip library={library} />
            </main>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
