import type { CSSProperties } from "react";
import { Spin } from "antd";
import { ChevronLeft, ChevronRight, FileX2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ViewerAnnotation } from "../../../hooks/useViewerAnnotation";
import { ViewerAnnotationCanvas } from "../image/ViewerAnnotationCanvas";
import type { ConsultingLibrary } from "./useConsultingLibrary";

interface Props {
  library: ConsultingLibrary;
  annotation: ViewerAnnotation;
  drawing: boolean;
  /** How many of the patient's photographs the arrows could step through. */
  imageCount: number;
  onStep: (delta: number) => void;
}

function EmptySheet({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="pd-lib-empty">
      <span className="pd-lib-empty__icon">
        <FileX2 size={24} />
      </span>
      <p className="pd-lib-empty__title">{title}</p>
      <p className="pd-lib-empty__hint">{hint}</p>
    </div>
  );
}

/**
 * The page of the library: the chosen content's write-up on a white sheet,
 * zoomed and optionally inverted like an X-ray film, with the drawing canvas
 * over it. Without a content it shows why, and the arrows the reference keeps
 * for the patient's photographs.
 */
export function ConsultingLibrarySheet({
  library,
  annotation,
  drawing,
  imageCount,
  onStep,
}: Props) {
  const { content, contentsLoading, contentsError, retryContents, zoom, inverted } = library;
  const html = content?.content?.trim() ?? "";

  if (html) {
    const sheetClass = ["pd-lib-sheet", inverted && "pd-lib-sheet--inverted"]
      .filter(Boolean)
      .join(" ");
    return (
      <div className="pd-lib-body pd-lib-body--sheet">
        <div className={sheetClass} style={{ "--pd-lib-zoom": zoom / 100 } as CSSProperties}>
          <article className="pd-lib-article" dangerouslySetInnerHTML={{ __html: html }} />
          <ViewerAnnotationCanvas active={drawing} annotation={annotation} />
        </div>
      </div>
    );
  }

  let state: React.ReactNode;
  if (contentsLoading && !content) {
    state = (
      <div className="pd-lib-empty">
        <Spin />
        <p className="pd-lib-empty__hint">{t("Đang tải nội dung tư vấn...")}</p>
      </div>
    );
  } else if (contentsError) {
    state = (
      <div className="pd-lib-empty">
        <p className="pd-lib-empty__title">{t("Không thể tải nội dung tư vấn.")}</p>
        <button type="button" className="tp-btn tp-btn--outline" onClick={retryContents}>
          {t("Thử lại")}
        </button>
      </div>
    );
  } else if (content) {
    state = (
      <EmptySheet
        title={t("Nội dung tư vấn đang trống")}
        hint={t("Hãy cập nhật nội dung cho mục này.")}
      />
    );
  } else {
    state = (
      <EmptySheet
        title={t("Chưa có dữ liệu tư vấn")}
        hint={t("Chọn một chủ đề để xem nội dung.")}
      />
    );
  }

  return (
    <div className="pd-lib-body">
      {state}
      <button
        type="button"
        className="pd-lib-arrow pd-lib-arrow--prev"
        aria-label={t("Ảnh trước")}
        disabled={imageCount < 2}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        className="pd-lib-arrow pd-lib-arrow--next"
        aria-label={t("Ảnh sau")}
        disabled={imageCount < 2}
        onClick={() => onStep(1)}
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
