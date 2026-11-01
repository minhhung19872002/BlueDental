import { Image } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PatientImageDto } from "../../../api/patientImageApi";

interface Props {
  images: PatientImageDto[];
  /** treatmentImage.delete; a picture still needs its upload day (`deletable`). */
  canDelete: boolean;
  onDelete: (image: PatientImageDto) => void;
}

/**
 * The công đoạn's pictures under its service on LỊCH SỬ ĐIỀU TRỊ. The red ×
 * in a tile's corner deletes it, on the day it was uploaded only (P0111_02,
 * R-1111) — the server refuses later days as well.
 */
export function StageHistoryShots({ images, canDelete, onDelete }: Props) {
  if (images.length === 0) return null;

  return (
    <div className="pd-stage-histshots">
      <Image.PreviewGroup>
        {images.map((image) => (
          <span key={image.id}>
            <Image src={image.url} alt={t("Patient:Photo:Treatment")} />
            <em>{t("Patient:Photo:Treatment")}</em>
            {canDelete && image.deletable && (
              <button
                type="button"
                className="pd-stage-histshot-remove"
                aria-label={t("Patient:Image:DeleteLabel")}
                onClick={() => onDelete(image)}
              >
                <CloseOutlined />
              </button>
            )}
          </span>
        ))}
      </Image.PreviewGroup>
    </div>
  );
}
