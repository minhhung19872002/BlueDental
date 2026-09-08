import { useEffect, useState } from "react";
import { Checkbox, Tooltip } from "antd";
import { Images } from "lucide-react";
import { t } from "@/lib/i18n";
import { QuoteImageListDialog } from "./QuoteImageListDialog";
import type { QuoteImage } from "./quoteModel";

const PAGE = 10;

interface Props {
  images: QuoteImage[];
  /** Ids ticked for printing on the diagnosis sheet. */
  printing: Set<string>;
  onPrintingChange: (next: Set<string>) => void;
}

/**
 * "Ảnh chẩn đoán" — the sticky aside of Chi tiết phiếu. The album's images
 * show ten at a time (ten more as the list nears its end); the tick on each
 * puts it on the printed diagnosis sheet. Taking an image off the aside
 * (through Danh sách ảnh) also takes it off the print.
 */
export function QuoteImageAside({ images, printing, onPrintingChange }: Props) {
  const [visible, setVisible] = useState(() => new Set(images.map((image) => image.id)));
  const [albumOpen, setAlbumOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    setVisible(new Set(images.map((image) => image.id)));
  }, [images]);

  const listed = images.filter((image) => visible.has(image.id));

  const togglePrint = (id: string) => {
    const next = new Set(printing);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onPrintingChange(next);
  };

  const toggleVisible = (id: string) => {
    const next = new Set(visible);
    if (next.has(id)) {
      next.delete(id);
      if (printing.has(id)) {
        const rest = new Set(printing);
        rest.delete(id);
        onPrintingChange(rest);
      }
    } else {
      next.add(id);
    }
    setVisible(next);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40 && shown < listed.length) {
      setShown((count) => count + PAGE);
    }
  };

  return (
    <aside className="pq-aside">
      <div className="pq-aside-head">
        <div>
          <p className="pq-aside-title">{t("Ảnh chẩn đoán")}</p>
          <p className="pq-aside-hint">{t("Chọn ảnh để đưa vào form in.")}</p>
        </div>
        <Tooltip title={t("Danh sách ảnh")}>
          <button
            type="button"
            className="pq-square"
            aria-label={t("Danh sách ảnh")}
            onClick={() => setAlbumOpen(true)}
          >
            <Images size={20} />
          </button>
        </Tooltip>
      </div>

      {listed.length === 0 ? (
        <button type="button" className="pq-aside-empty" onClick={() => setAlbumOpen(true)}>
          <Images size={32} />
          {t("Chưa có ảnh hiển thị. Bấm để mở danh sách ảnh.")}
        </button>
      ) : (
        <div className="pq-aside-list" onScroll={handleScroll}>
          {listed.slice(0, shown).map((image) => (
            <div
              key={image.id}
              role="button"
              tabIndex={0}
              className="pq-aside-item"
              onClick={() => togglePrint(image.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") togglePrint(image.id);
              }}
            >
              <img src={image.src} alt={image.alt} loading="lazy" />
              <Checkbox
                checked={printing.has(image.id)}
                aria-label={t("In ảnh {0}", image.alt)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => togglePrint(image.id)}
              />
            </div>
          ))}
        </div>
      )}

      <QuoteImageListDialog
        open={albumOpen}
        images={images}
        visible={visible}
        onToggle={toggleVisible}
        onSelectAll={() => setVisible(new Set(images.map((image) => image.id)))}
        onClose={() => setAlbumOpen(false)}
      />
    </aside>
  );
}
