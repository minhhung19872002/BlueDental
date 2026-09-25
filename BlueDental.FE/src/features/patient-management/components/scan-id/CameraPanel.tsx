import { useState, type ReactNode } from "react";
import { Button, Select, Spin } from "antd";
import { CameraOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useQrCamera, type CameraStatus, type ScanAdvice } from "../../hooks/useQrCamera";
import { QrBox } from "./QrBox";

interface Props {
  /** The camera is actually reading — off while a read card is previewed. */
  running: boolean;
  /** A card has been read; the box shows the frame it came from. */
  finished: boolean;
  onToggle: () => void;
  /** True when the text was a card and the scan is done. */
  onDecode: (text: string) => boolean;
  /** Sits beside the camera button — "Tải ảnh". */
  children?: ReactNode;
}

const CAMERA_KEY = "bd.scanId.camera";

function savedCamera(): string | undefined {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberCamera(deviceId: string): void {
  try {
    localStorage.setItem(CAMERA_KEY, deviceId);
  } catch {
    // Private mode: the choice just lasts for this dialog.
  }
}

/** The line under a live picture: advice when the scan is stuck, else what to do. */
function liveHint(found: boolean, advice: ScanAdvice): { text: string; advice: boolean } {
  if (advice === "soft") return { text: "Patient:ScanId:AdviceSoft", advice: true };
  if (advice === "notFound") return { text: "Patient:ScanId:AdviceNotFound", advice: true };
  return { text: found ? "Patient:ScanId:Reading" : "Patient:ScanId:LiveHint", advice: false };
}

const STATUS_TEXT: Partial<Record<CameraStatus, string>> = {
  denied: "Patient:ScanId:CameraDenied",
  unavailable: "Patient:ScanId:NoCamera",
  insecure: "Patient:ScanId:Insecure",
};

/**
 * The left half of "Quét CCCD": the camera box and its controls.
 *
 * No fixed target is drawn: while scanning, the box finds the QR itself and
 * wraps its corners. Once the card is read the frame it came from stays on
 * screen, bare — a box redrawn on the still drifted off the code. The picture
 * is never mirrored. The camera opens with the dialog; the button stops it, or
 * asks again when it could not be opened.
 */
export function CameraPanel({ running, finished, onToggle, onDecode, children }: Props) {
  const [deviceId, setDeviceId] = useState(savedCamera);
  const [attempt, setAttempt] = useState(0);
  const camera = useQrCamera({ active: running, deviceId, attempt, onDecode });
  const live = camera.status === "live";
  // Asked for but refused or missing: the button tries again rather than
  // switching off a camera that never came on.
  const failed = running && camera.status in STATUS_TEXT;
  const on = running && !failed;
  const frozen = finished ? camera.capture : null;

  const handleCamera = (next: string) => {
    setDeviceId(next);
    rememberCamera(next);
  };

  const hint = liveHint(Boolean(camera.sighting), camera.advice);
  const idleText = finished
    ? t("Patient:ScanId:Done")
    : t(STATUS_TEXT[camera.status] ?? "Patient:ScanId:IdleHint");

  return (
    <div className="bd-idscan-camera-panel">
      <div
        className={["bd-idscan-camera", live && !frozen && "bd-idscan-camera--live"]
          .filter(Boolean)
          .join(" ")}
      >
        <video
          ref={camera.videoRef}
          className="bd-idscan-video"
          muted
          playsInline
          aria-label={t("Patient:ScanId:Camera")}
        />

        {frozen && <img className="bd-idscan-frozen" src={frozen} alt={t("Patient:ScanId:Done")} />}

        {live && !frozen && (
          <>
            {camera.sighting ? (
              <QrBox sighting={camera.sighting} />
            ) : (
              <div className="bd-idscan-sweep" aria-hidden="true" />
            )}
            <p
              className={["bd-idscan-live-hint", hint.advice && "bd-idscan-live-hint--advice"]
                .filter(Boolean)
                .join(" ")}
              role={hint.advice ? "status" : undefined}
            >
              {t(hint.text)}
            </p>
          </>
        )}

        {!live && !frozen && (
          <div className="bd-idscan-idle">
            {camera.status === "starting" ? (
              <Spin />
            ) : (
              <span className="bd-idscan-idle-icon" aria-hidden="true">
                <CameraOutlined />
              </span>
            )}
            <p>{camera.status === "starting" ? t("Patient:ScanId:Starting") : idleText}</p>
          </div>
        )}
      </div>

      <div className="bd-idscan-actions">
        {/* While a read card is previewed the camera is already off; "Quét
            lại" in the footer brings it back if it was on. */}
        <Button
          type="primary"
          size="large"
          className="bd-idscan-toggle"
          disabled={finished}
          icon={on ? <PauseCircleOutlined /> : <CameraOutlined />}
          onClick={failed ? () => setAttempt((count) => count + 1) : onToggle}
        >
          {on ? t("Patient:ScanId:StopCamera") : t("Patient:ScanId:OpenCamera")}
        </Button>
        {running && camera.cameras.length > 1 && (
          <Select
            size="large"
            className="bd-idscan-camera-select"
            value={deviceId ?? camera.activeDeviceId}
            aria-label={t("Patient:ScanId:SelectCamera")}
            placeholder={t("Patient:ScanId:SelectCamera")}
            options={camera.cameras.map((device, index) => ({
              value: device.deviceId,
              label: device.label || `${t("Patient:ScanId:Camera")} ${index + 1}`,
            }))}
            onChange={handleCamera}
          />
        )}
        {children}
      </div>
    </div>
  );
}
