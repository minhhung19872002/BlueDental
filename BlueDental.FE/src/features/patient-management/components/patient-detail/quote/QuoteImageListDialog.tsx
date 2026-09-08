import { Checkbox, Modal } from "antd";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { QuoteImage } from "./quoteModel";

interface Props {
  open: boolean;
  images: QuoteImage[];
  /** Ids shown in the aside — the album ticks and unticks these. */
  visible: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClose: () => void;
}

/**
 * "Danh sách ảnh" — the album behind the aside's square button. Ticking a
 * card puts the image on the aside; "Chọn tất cả" puts every one there.
 */
export function QuoteImageListDialog({
  open,
  images,
  visible,
  onToggle,
  onSelectAll,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tp-dialog"
      width="min(960px, calc(100vw - 32px))"
      zIndex={1200}
      closeIcon={<X size={20} />}
      title={t("Danh sách ảnh")}
      footer={
        <div className="pq-footer">
          <button type="button" className="tp-btn tp-btn--outline" onClick={onSelectAll}>
            {t("Chọn tất cả")}
          </button>
          <button type="button" className="tp-btn tp-btn--primary" onClick={onClose}>
            {t("Xong")}
          </button>
        </div>
      }
    >
      {images.length === 0 ? (
        <div className="pq-album-empty">{t("Chưa có ảnh trong album.")}</div>
      ) : (
        <div className="pq-album">
          {images.map((image) => {
            const on = visible.has(image.id);
            return (
              <div
                key={image.id}
                role="button"
                tabIndex={0}
                className={on ? "pq-album-card pq-album-card--on" : "pq-album-card"}
                onClick={() => onToggle(image.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onToggle(image.id);
                }}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
                <Checkbox
                  checked={on}
                  aria-label={image.alt}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => onToggle(image.id)}
                />
                <p className="pq-album-name">{image.alt}</p>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
