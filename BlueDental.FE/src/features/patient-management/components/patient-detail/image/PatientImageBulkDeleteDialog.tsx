import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

/** As many thumbnails as fit one row of the dialog; the rest are counted. */
const THUMB_LIMIT = 8;

interface Props {
  /** Null while the dialog is closed. */
  images: PatientImageViewModel[] | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * "Xoá N ảnh?" (R-1277): the same red confirm as deleting one picture, with
 * the ticked pictures shown small so the last look is at what goes, not a number.
 */
export function PatientImageBulkDeleteDialog({ images, pending, onConfirm, onClose }: Props) {
  const count = images?.length ?? 0;
  const thumbs = images?.slice(0, THUMB_LIMIT) ?? [];
  const more = count - thumbs.length;

  return (
    <ConfirmDeleteDialog
      open={images !== null}
      noun={t("Patient:Image:Noun")}
      title={t("Patient:Image:DeleteManyTitle", count)}
      question={
        <span className="pi-bulk-question">
          <span>{t("Patient:Image:DeleteManyQuestion", count)}</span>
          <span className="pi-bulk-thumbs" data-testid="patient-image-bulk-thumbs">
            {thumbs.map((image) => (
              <img key={image.id} className="pi-bulk-thumb" src={image.url} alt={image.fileName} />
            ))}
            {more > 0 && <span className="pi-bulk-more">+{more}</span>}
          </span>
        </span>
      }
      confirmLabel={t("Patient:Image:DeleteMany", count)}
      pending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
