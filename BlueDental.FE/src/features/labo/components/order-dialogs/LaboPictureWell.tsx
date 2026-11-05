import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import { LaboPictureGallery, type LaboPictureTile } from "./LaboPictureGallery";

export type { LaboPictureTile } from "./LaboPictureGallery";

interface Props {
  tiles: LaboPictureTile[];
  /** While Lưu is uploading the well is greyed and reads "Đang tải". */
  busy: boolean;
  /**
   * Without `laboTemplate:update` staging keeps the strip but drops the
   * "Tải ảnh" well and the "Xóa ảnh" corners (docs/clone/pages/labo.md §2.6).
   */
  readOnly?: boolean;
  /**
   * "defect" is a Lỗi tooth's Hình ảnh lỗi: a square dashed tile reading
   * `label`, the square thumbnails beside it (P3110 m278, P0111_02 R-1113).
   */
  variant?: "well" | "defect";
  /** The text of the "defect" tile, e.g. "2/5". */
  label?: string;
  /** The accessible name of the "defect" tile, e.g. "Tải ảnh lỗi R12". */
  addLabel?: string;
  onAdd?: (files: File[]) => void;
  onRemove?: (tile: LaboPictureTile) => void;
}

/**
 * The detail dialog's "Tải ảnh" well and the strip of pictures under it,
 * measured on staging (docs/clone/pages/labo.md §2.6): a 110px dashed square
 * with the image-plus glyph, then 150px tiles each with "Xem ảnh" over the
 * picture and "Xóa ảnh" in its top-right corner. A tile opens the lightbox on
 * that picture; the well takes several files at once.
 */
export function LaboPictureWell({ tiles, busy, readOnly, variant = "well", label, addLabel, onAdd, onRemove }: Props) {
  const defect = variant === "defect";
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className={variant === "well" ? "pd-labo-pictures" : `pd-labo-pictures pd-labo-pictures--${variant}`}>
      {!readOnly && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              onAdd?.(Array.from(event.target.files ?? []));
              // Cleared so choosing the same file twice still fires a change.
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
          <button
            type="button"
            className={defect ? "pd-labo-defectwell" : "pd-labo-well"}
            disabled={busy}
            aria-label={addLabel}
            onClick={() => fileInput.current?.click()}
          >
            {defect && (
              <>
                <ImagePlus size={20} aria-hidden />
                <span>{label}</span>
              </>
            )}
            {variant === "well" && (
              <>
                <ImagePlus size={28} aria-hidden />
                <span>{busy ? t("Patient:Labo:Uploading") : t("Patient:Photo:Upload")}</span>
              </>
            )}
          </button>
        </>
      )}

      <LaboPictureGallery tiles={tiles} busy={busy} readOnly={readOnly} onRemove={onRemove} />
    </div>
  );
}
