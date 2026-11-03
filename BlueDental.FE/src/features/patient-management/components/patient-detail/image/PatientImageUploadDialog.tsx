import { useRef, useState } from "react";
import { Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { X } from "lucide-react";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { PATIENT_IMAGE_NOTE_MAX } from "../../../api/patientImageApi";
import type { ImagePreview } from "../../../hooks/useImagePreviews";
import type { UploadProgress } from "../../../hooks/usePatientImageUpload";
import { ImageFileInput } from "./ImageFileInput";

interface Props {
  stageLabel: string;
  pictures: ImagePreview[];
  /** How far an upload has got; `null` while nothing is being sent. */
  progress: UploadProgress | null;
  onAdd: (files: File[]) => void;
  onRemove: (picture: ImagePreview) => void;
  /** Sends every picture with this one note. */
  onUpload: (note: string) => void;
  onClose: () => void;
}

/**
 * "Tải ảnh lên · {giai đoạn}": the picked pictures as thumbnails, each with a
 * × to take it back and "+ Chọn thêm ảnh" to add more, then one "Ghi chú" that
 * every picture of the batch is stored with. Nothing can be changed or closed
 * while the batch is on its way up.
 */
export function PatientImageUploadDialog({ stageLabel, pictures, progress, onAdd, onRemove, onUpload, onClose }: Props) {
  const moreRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const uploading = progress !== null;
  const count = pictures.length;

  const handleClose = () => {
    if (!uploading) onClose();
  };

  return (
    <AppDialog
      open
      centered
      width="min(640px, calc(100vw - 32px))"
      className="pi-up-dialog"
      title={t("Patient:Image:UploadTitle", stageLabel)}
      canSave={count > 0}
      saving={uploading}
      saveLabel={t("Patient:Image:UploadCount", count)}
      savingLabel={
        progress ? t("Patient:Photo:UploadProgress", progress.sending, progress.total) : t("Common:Uploading")
      }
      saveIcon={<UploadOutlined />}
      cancelLabel={t("Common:Cancel")}
      footerLeft={count > 1 ? <span className="pi-up-hint">{t("Patient:Image:NoteForAll", count)}</span> : null}
      onSave={() => onUpload(note)}
      onClose={handleClose}
    >
      <div className="pi-up-body">
        <div className="pi-up-head">
          <span className="pi-up-count">{t("Patient:Image:PickedCount", count)}</span>
          <button type="button" className="pi-up-more" disabled={uploading} onClick={() => moreRef.current?.click()}>
            {t("Patient:Image:PickMore")}
          </button>
          <ImageFileInput inputRef={moreRef} onFiles={onAdd} testId="patient-image-more-input" />
        </div>

        {count === 0 ? (
          <p className="pi-up-empty">{t("Patient:Image:NonePicked")}</p>
        ) : (
          <ul className="pi-up-grid" aria-label={t("Patient:Image:PickedCount", count)}>
            {pictures.map((picture) => (
              <li key={picture.id} className="pi-up-item" data-testid="picked-image">
                <img src={picture.url} alt={picture.file.name} />
                <button
                  type="button"
                  className="pi-shot-remove"
                  aria-label={t("Patient:Image:RemovePicked", picture.file.name)}
                  disabled={uploading}
                  onClick={() => onRemove(picture)}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="pi-up-note">
          <span>{t("Patient:Image:Note")}</span>
          <Input.TextArea
            value={note}
            rows={2}
            maxLength={PATIENT_IMAGE_NOTE_MAX}
            placeholder={t("Patient:Image:NotePlaceholder")}
            disabled={uploading}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </AppDialog>
  );
}
