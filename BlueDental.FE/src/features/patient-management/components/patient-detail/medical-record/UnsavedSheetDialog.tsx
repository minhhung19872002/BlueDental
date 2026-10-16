import { Button, Modal } from "antd";
import { t, tRich } from "@/lib/i18n";

interface Props {
  open: boolean;
  saving: boolean;
  /** The sheets with unsaved writing, by their names. */
  titles: string[];
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}

/**
 * Asked before a sheet with unsaved writing is left: save it and go on, go on
 * without it, or stay. See useUnsavedSheets.
 */
export function UnsavedSheetDialog({ open, saving, titles, onSave, onDiscard, onStay }: Props) {
  return (
    <Modal
      open={open}
      title={t("Patient:MedRecord:UnsavedTitle")}
      closable={!saving}
      maskClosable={false}
      onCancel={saving ? undefined : onStay}
      footer={[
        <Button key="stay" disabled={saving} onClick={onStay}>
          {t("Patient:MedRecord:UnsavedStay")}
        </Button>,
        <Button key="discard" danger disabled={saving} onClick={onDiscard}>
          {t("Patient:MedRecord:UnsavedDiscard")}
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={onSave}>
          {t("Patient:MedRecord:UnsavedSave")}
        </Button>,
      ]}
    >
      <p>{tRich("Patient:MedRecord:UnsavedContent", <strong>{titles.join(", ")}</strong>)}</p>
    </Modal>
  );
}
