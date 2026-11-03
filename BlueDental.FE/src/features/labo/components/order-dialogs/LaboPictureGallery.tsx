import { useState } from "react";
import { Image } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

/** One tile on the strip: a saved picture or a draft still to be uploaded. */
export interface LaboPictureTile {
  key: string;
  url: string;
  name: string;
}

interface Props {
  tiles: LaboPictureTile[];
  busy: boolean;
  /** No "Xóa ảnh" corners. */
  readOnly?: boolean;
  onRemove?: (tile: LaboPictureTile) => void;
}

/**
 * The strip of pictures: each tile opens the lightbox on that picture, and
 * "Xóa ảnh" sits in its top-right corner. Shared by the Đặt hàng wells and the
 * check's tooth rows (P0111_02, R-1110).
 */
export function LaboPictureGallery({ tiles, busy, readOnly, onRemove }: Props) {
  const [preview, setPreview] = useState<number | null>(null);
  if (tiles.length === 0) return null;

  return (
    <>
      <div className="pd-labo-gallery">
        {tiles.map((tile, index) => (
          <div className="pd-labo-gallery-tile" key={tile.key}>
            <button
              type="button"
              className="pd-labo-gallery-view"
              aria-label={t("Patient:Photo:ViewFile", tile.name)}
              onClick={() => setPreview(index)}
            >
              <img src={tile.url} alt={tile.name} />
            </button>
            {!readOnly && (
              <button
                type="button"
                className="pd-labo-gallery-remove"
                aria-label={t("Patient:Labo:RemoveImage", tile.name)}
                disabled={busy}
                onClick={() => onRemove?.(tile)}
              >
                <CloseOutlined />
              </button>
            )}
          </div>
        ))}
      </div>
      <Image.PreviewGroup
        items={tiles.map((tile) => ({ src: tile.url, alt: tile.name }))}
        preview={{
          open: preview !== null,
          current: preview ?? 0,
          onOpenChange: (open) => {
            if (!open) setPreview(null);
          },
          onChange: (current) => setPreview(current),
        }}
      />
    </>
  );
}
