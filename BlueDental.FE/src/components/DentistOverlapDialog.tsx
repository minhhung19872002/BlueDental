import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";

interface Props {
  /** The server's overlap sentence; the dialog is open while there is one. */
  message?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * "Cảnh báo trùng khung giờ": the dentist already has a visit then. Xác nhận
 * books it anyway, Hủy goes back to the form. Driven by `useDentistOverlapConfirm`.
 */
export function DentistOverlapDialog({ message, onConfirm, onClose }: Props) {
  return (
    <ConfirmDialog
      open={message !== undefined}
      title={t("Appointment:Overlap:Title")}
      message={
        <>
          {message}
          <br />
          {t("Appointment:Overlap:Question")}
        </>
      }
      confirmLabel={t("Common:Confirm")}
      cancelLabel={t("Common:Cancel")}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
