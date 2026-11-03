import { Button } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { SignatureUpload } from "../../hooks/useAccountantSignature";

interface Props {
  upload: SignatureUpload | null;
  saving: boolean;
  onOther: () => void;
  onCancel: () => void;
  onUse: () => void;
}

/**
 * Xem ảnh chữ ký (P2910_02 mock): the picked picture as it will be kept,
 * its file name and size, then Chọn ảnh khác | Hủy · Dùng chữ ký này.
 */
export function SignatureUploadPreview({ upload, saving, onOther, onCancel, onUse }: Props) {
  return (
    <AppDialog
      open={upload !== null}
      title={t("Receipt:Upload:Title")}
      width={460}
      className="rcpt-upload-dialog"
      centered
      canSave={upload !== null}
      saving={saving}
      saveLabel={t("Receipt:Upload:Use")}
      savingLabel={t("Receipt:Upload:Use")}
      saveIcon={null}
      cancelLabel={t("Receipt:Upload:Cancel")}
      footerLeft={
        <Button className="rcpt-upload-other" disabled={saving} onClick={onOther}>
          {t("Receipt:Upload:Other")}
        </Button>
      }
      onSave={onUse}
      onClose={onCancel}
    >
      {upload && (
        <>
          <div className="rcpt-upload-stage">
            <img className="rcpt-upload-image" src={upload.dataUrl} alt={t("Receipt:Export:SignatureAlt")} />
          </div>
          <p className="rcpt-upload-file">{t("Receipt:Upload:FileInfo", upload.fileName, upload.sizeKb)}</p>
        </>
      )}
    </AppDialog>
  );
}
