import { t } from "@/lib/i18n";
import { RichTextField } from "@/components/RichTextField";
import { RichTextView } from "@/components/RichTextView";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import type { LaboPictureTiles } from "../order-dialogs/useLaboPictureTiles";

interface Props {
  /** Rich text (HTML) since P1211 — {@link asRichText} already applied. */
  notes: string;
  editable: boolean;
  pictures: LaboPictureTiles;
  busy: boolean;
  onChange: (notes: string) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/**
 * Yêu cầu: a text-only rich text box for the Labo (P1211, R-1212 — no ruled
 * lines any more), and Ảnh chung under it (kept at the BA's ask). A sent slip
 * reads the same body back without an editor.
 */
export function RequestNotes({ notes, editable, pictures, busy, onChange, title }: Props) {
  return (
    <section className="rs-sec">
      <div className="rs-sech">{title ?? t("Labo:Slip:Request")}</div>
      {editable ? (
        <RichTextField
          className="rs-note"
          value={notes}
          onChange={onChange}
          placeholder={t("Labo:Slip:RequestPlaceholder")}
          ariaLabel={t("Labo:Slip:Request")}
          media={false}
        />
      ) : (
        <RichTextView className="rs-note rs-note--view" html={notes} />
      )}
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
