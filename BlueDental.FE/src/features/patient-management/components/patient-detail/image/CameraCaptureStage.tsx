import { useState } from "react";
import { Button, Select, Spin } from "antd";
import { Camera, RotateCcw } from "lucide-react";
import { t } from "@/lib/i18n";
import { usePhotoCamera } from "../../../hooks/usePhotoCamera";
import { UPLOAD_BATCH_LIMIT } from "../../../hooks/usePatientImageUpload";
import { rememberCamera, savedCamera, type CameraStatus } from "../../../utils/camera/cameraStream";

interface Props {
  /** As many shots as one upload takes are waiting: "Chụp" rests. */
  full: boolean;
  /** The shots are being uploaded. */
  busy: boolean;
  onShot: (picture: Blob) => void;
}

const CAMERA_KEY = "bd.patientImage.camera";

/** What the dark box says while there is no picture in it. */
const STATUS_TEXT: Record<Exclude<CameraStatus, "live">, string> = {
  idle: "Patient:Image:CameraStarting",
  starting: "Patient:Image:CameraStarting",
  denied: "Patient:Image:CameraDenied",
  unavailable: "Patient:Image:CameraUnavailable",
  insecure: "Patient:Image:CameraInsecure",
};

/** A refusal or a lost camera can be asked for again; no HTTPS cannot. */
const RETRYABLE: ReadonlySet<CameraStatus> = new Set(["denied", "unavailable"]);

/**
 * The camera half of "Chụp ảnh": the live picture, a camera picker once there
 * is more than one (webcam and intraoral camera), and "Chụp". Each shot
 * flashes the picture so the desk sees it was taken.
 */
export function CameraCaptureStage({ full, busy, onShot }: Props) {
  const [deviceId, setDeviceId] = useState(() => savedCamera(CAMERA_KEY));
  const [attempt, setAttempt] = useState(0);
  const [flashes, setFlashes] = useState(0);
  const camera = usePhotoCamera({ deviceId, attempt });
  const live = camera.status === "live";

  const handleCamera = (next: string) => {
    setDeviceId(next);
    rememberCamera(CAMERA_KEY, next);
  };

  const handleSnap = async () => {
    const picture = await camera.snap();
    if (!picture) return;
    setFlashes((count) => count + 1);
    onShot(picture);
  };

  return (
    <div className="pi-cam">
      <div className={["pi-cam-view", live && "pi-cam-view--live"].filter(Boolean).join(" ")}>
        <video
          ref={camera.videoRef}
          className="pi-cam-video"
          muted
          playsInline
          aria-label={t("Patient:Image:CameraView")}
        />
        {flashes > 0 && <div key={flashes} className="pi-cam-flash" aria-hidden="true" />}
        {camera.status !== "live" && (
          <div className="pi-cam-idle" role="status">
            {camera.status === "starting" || camera.status === "idle" ? <Spin /> : <Camera size={32} />}
            <p>{t(STATUS_TEXT[camera.status])}</p>
            {RETRYABLE.has(camera.status) && (
              <Button icon={<RotateCcw size={16} />} onClick={() => setAttempt((count) => count + 1)}>
                {t("Patient:Image:CameraRetry")}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="pi-cam-controls">
        {camera.cameras.length > 1 && (
          <Select
            size="large"
            className="pi-cam-select"
            value={camera.activeDeviceId ?? deviceId}
            aria-label={t("Patient:ScanId:SelectCamera")}
            options={camera.cameras.map((device, index) => ({
              value: device.deviceId,
              label: device.label || `${t("Patient:Image:CameraView")} ${index + 1}`,
            }))}
            onChange={handleCamera}
          />
        )}
        {full && <span className="pi-cam-full">{t("Patient:Image:ShotsFull", UPLOAD_BATCH_LIMIT)}</span>}
        <Button
          type="primary"
          size="large"
          className="pi-cam-snap"
          icon={<Camera size={18} />}
          disabled={!live || full || busy}
          onClick={() => void handleSnap()}
        >
          {t("Patient:Image:Snap")}
        </Button>
      </div>
    </div>
  );
}
