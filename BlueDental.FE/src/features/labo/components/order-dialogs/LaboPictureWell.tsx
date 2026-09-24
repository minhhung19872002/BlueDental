import { useRef, useState } from "react";
import { Image } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { ImagePlus } from "lucide-react";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";

/** One tile on the strip: a saved picture or a draft still to be uploaded. */
export interface LaboPictureTile {
  key: string;
  url: string;
  name: string;
}

interface Props {
  tiles: LaboPictureTile[];
  /** While Lưu is uploading the well is greyed and reads "Đang tải". */
  busy: boolean;
  /**
   * Without `laboTemplate:update` staging keeps the strip but drops the
   * "Tải ảnh" well and the "Xóa ảnh" corners (docs/clone/pages/labo.md §2.6).
   */
  readOnly?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (tile: LaboPictureTile) => void;
}

/**
 * The detail dialog's "Tải ảnh" well and the strip of pictures under it,
 * measured on staging (docs/clone/pages/labo.md §2.6): a 110px dashed square
 * with the image-plus glyph, then 150px tiles each with "Xem ảnh" over the
 * picture and "Xóa ảnh" in its top-right corner. A tile opens the lightbox on
 * that picture; the well takes several files at once.
 */
export function LaboPictureWell({ tiles, busy, readOnly, onAdd, onRemove }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<number | null>(null);

  return (
    <div className="pd-labo-pictures">
      {!readOnly && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              onAdd(Array.from(event.target.files ?? []));
              // Cleared so choosing the same file twice still fires a change.
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
          <button
            type="button"
            className="pd-labo-well"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={28} aria-hidden />
            <span>{busy ? t("Patient:Labo:Uploading") : t("Patient:Photo:Upload")}</span>
          </button>
        </>
      )}

      {tiles.length > 0 && (
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
                  onClick={() => onRemove(tile)}
                >
                  <CloseOutlined />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
