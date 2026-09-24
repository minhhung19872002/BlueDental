import { useRef, useState, type ChangeEvent } from "react";
import { Alert, Button } from "antd";
import { PictureOutlined, ReloadOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { ScanState } from "../../hooks/useNationalIdScan";
import { decodeQrFile } from "../../utils/qr/qrDecoder";
import { CameraPanel } from "./CameraPanel";
import { CccdPreviewCard, type PreviewStatus } from "./CccdPreviewCard";

interface Props {
  state: ScanState;
  /** QR text from the camera or a photo; true when it was a card. */
  onRead: (raw: string) => boolean;
  onRescan: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const PREVIEW_STATUS: Record<ScanState["step"], PreviewStatus> = {
  scanning: "empty",
  checking: "checking",
  ready: "new",
  failed: "failed",
};

/**
 * "Quét CCCD" — the camera (or a photo of the card) on the left, the card's
 * contents on the right. A card already on file never shows here: the page
 * narrows the list to it and closes the dialog. A new one is previewed, and
 * "Tạo hồ sơ" opens the record form filled from it.
 */
export function NationalIdScanDialog({ state, onRead, onRescan, onConfirm, onClose }: Props) {
  // The camera opens with the dialog — nothing to press first.
  const [cameraOn, setCameraOn] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scanning = state.step === "scanning";
  // Only shown once it is known to be new, so a card already on file does not
  // flash its details before the dialog closes.
  const card = state.step === "ready" || state.step === "failed" ? state.card : null;

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError(null);
    try {
      const result = await decodeQrFile(file);
      if (result.text) onRead(result.text);
      else setImageError(t("Patient:ScanId:NoQrInImage"));
    } catch {
      setImageError(t("Patient:ScanId:NoQrInImage"));
    }
  };

  const handleRescan = () => {
    setImageError(null);
    onRescan();
  };

  const message = imageError ?? (state.step === "scanning" ? state.error : null);

  return (
    <AppDialog
      open
      width="min(1240px, calc(100vw - 48px))"
      centered
      className="bd-idscan-dialog"
      title={t("Patient:ScanId:Title")}
      subtitle={t("Patient:ScanId:Subtitle")}
      canSave={state.step === "ready"}
      saving={state.step === "checking"}
      saveLabel={t("Patient:ScanId:CreateRecord")}
      footerLeft={
        card ? (
          <Button icon={<ReloadOutlined />} onClick={handleRescan}>
            {t("Patient:ScanId:Rescan")}
          </Button>
        ) : null
      }
      onSave={onConfirm}
      onClose={onClose}
    >
      <div className="bd-idscan-grid">
        <div className="bd-idscan-left">
          <CameraPanel
            running={cameraOn && scanning}
            finished={!scanning}
            onToggle={() => setCameraOn((on) => !on)}
            onDecode={onRead}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleImage(event)}
            />
            <Button
              size="large"
              icon={<PictureOutlined />}
              disabled={!scanning}
              onClick={() => fileRef.current?.click()}
            >
              {t("Patient:ScanId:FromImage")}
            </Button>
          </CameraPanel>

          {message && <Alert type="error" showIcon className="bd-idscan-error" message={message} />}
        </div>

        <CccdPreviewCard
          card={card}
          address={state.step === "ready" ? state.address : null}
          status={PREVIEW_STATUS[state.step]}
          error={state.step === "failed" ? state.error : null}
        />
      </div>
    </AppDialog>
  );
}
