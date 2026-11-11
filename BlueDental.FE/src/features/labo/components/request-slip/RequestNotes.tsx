import { t } from "@/lib/i18n";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import type { LaboPictureTiles } from "../order-dialogs/useLaboPictureTiles";

interface Props {
  notes: string;
  editable: boolean;
  pictures: LaboPictureTiles;
  busy: boolean;
  onChange: (notes: string) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/** Yêu cầu: the lined note for the Labo, and Ảnh chung under it (kept at the BA's ask). */
export function RequestNotes({ notes, editable, pictures, busy, onChange, title }: Props) {
  return (
    <section className="rs-sec">
      <div className="rs-sech">{title ?? t("Labo:Slip:Request")}</div>
      <textarea
        className="rs-note"
        rows={3}
        value={notes}
        readOnly={!editable}
        maxLength={1000}
        placeholder={t("Labo:Slip:RequestPlaceholder")}
        aria-label={t("Labo:Slip:Request")}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="rs-pictures">
        <p className="pd-labo-row-label">
          {t("Labo:Workflow:CommonImages")} <span className="pd-labo-row-hint">{t("Labo:Workflow:CommonImagesHint")}</span>
        </p>
        <LaboPictureWell
          tiles={pictures.tilesOf("common")}
          busy={busy}
          readOnly={!editable}
          onAdd={(files) => pictures.addPictures("common", files)}
          onRemove={pictures.removeTile}
        />
      </div>
    </section>
  );
}
