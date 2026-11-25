import { useState, type FormEvent } from "react";
import { Button, Input, Modal } from "antd";
import { t } from "@/lib/i18n";
import { PATIENT_IMAGE_FOLDER_NAME_MAX } from "../../../api/patientImageFolderApi";
import { patientImageFolderNameSchema } from "./patientImageFolderSchema";

interface Props {
  /** "Thư mục mới" or "Đổi tên thư mục". */
  title: string;
  /** The name the field opens on: empty for a new thư mục, the current one to rename. */
  initialName: string;
  saving: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** Names a new thư mục, or renames one (F-98). Enter saves; the server refuses a name the column already has. */
export function PatientImageFolderDialog({ title, initialName, saving, onSave, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = patientImageFolderNameSchema().safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    onSave(parsed.data);
  };

  return (
    <Modal
      open
      title={<h2 className="bd-modal-title">{title}</h2>}
      width={420}
      destroyOnHidden
      onCancel={onClose}
      footer={
        <div className="pi-folder-dialog-footer">
          <Button onClick={onClose} disabled={saving}>
            {t("Common:CancelAlt")}
          </Button>
          <Button type="primary" loading={saving} disabled={saving} onClick={() => handleSubmit()}>
            {t("Common:Save")}
          </Button>
        </div>
      }
    >
      <form className="pi-folder-dialog" onSubmit={handleSubmit} noValidate>
        <label className="pi-folder-dialog-label" htmlFor="pi-folder-name">
          {t("Patient:Image:FolderName")} <span className="bd-required-mark" aria-hidden="true">*</span>
        </label>
        <Input
          id="pi-folder-name"
          autoFocus
          value={name}
          maxLength={PATIENT_IMAGE_FOLDER_NAME_MAX}
          status={error ? "error" : undefined}
          placeholder={t("Patient:Image:FolderNamePlaceholder")}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {error && (
          <p className="pi-folder-dialog-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
