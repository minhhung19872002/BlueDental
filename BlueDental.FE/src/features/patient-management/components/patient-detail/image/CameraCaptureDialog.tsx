import { toast } from "sonner";
import { UploadOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { useCapturedShots } from "../../../hooks/useCapturedShots";
import type { UploadProgress } from "../../../hooks/usePatientImageUpload";
import { CameraCaptureStage } from "./CameraCaptureStage";
import { CapturedShotStrip } from "./CapturedShotStrip";

interface Props {
  /** The "Giai đoạn điều trị" the shots will be filed under. */
  stageLabel: string;
  /** How far an upload has got; `null` while nothing is being sent. */
  progress: UploadProgress | null;
  /** Resolves to the files that reached the server. */
  onUpload: (files: File[]) => Promise<File[]>;
  onClose: () => void;
}

/**
 * "Chụp ảnh": the camera opens with the dialog, any number of shots are taken
 * and can be taken back, and "Tải lên" sends them all the way "Tải ảnh" sends
 * picked files. Shots that went up leave the strip; if all did, the dialog
 * closes and the camera switches off with it.
 */
export function CameraCaptureDialog({ stageLabel, progress, onUpload, onClose }: Props) {
  const capture = useCapturedShots();
  const count = capture.shots.length;
  const uploading = progress !== null;

  const handleUpload = async () => {
    const batch = capture.shots;
    const sent = new Set(await onUpload(batch.map((shot) => shot.file)));
    capture.discard(batch.filter((shot) => sent.has(shot.file)));
    if (sent.size > 0) toast.success(t("Patient:Image:ShotsUploaded", sent.size));
    if (sent.size === batch.length) onClose();
  };

  // Shots on their way up cannot be abandoned half-sent.
  const handleClose = () => {
    if (!uploading) onClose();
  };

  return (
    <AppDialog
      open
      centered
      width="min(960px, calc(100vw - 32px))"
      className="pi-cam-dialog"
      title={t("Patient:Image:Capture")}
      subtitle={t("Patient:Image:CaptureSubtitle", stageLabel)}
      canSave={count > 0}
      saving={uploading}
      saveLabel={t("Patient:Image:UploadShots", count)}
      savingLabel={
        progress ? t("Patient:Photo:UploadProgress", progress.sending, progress.total) : t("Common:Uploading")
      }
      saveIcon={<UploadOutlined />}
      cancelLabel={t("Common:Cancel")}
      footerLeft={<span className="pi-cam-count">{t("Patient:Image:ShotCount", count)}</span>}
      onSave={() => void handleUpload()}
      onClose={handleClose}
    >
      <div className="pi-cam-body">
        <CameraCaptureStage busy={uploading} onShot={capture.add} />
        <CapturedShotStrip shots={capture.shots} busy={uploading} onRemove={capture.remove} />
      </div>
    </AppDialog>
  );
}
