import { Tooltip } from "antd";
import { Camera } from "lucide-react";
import { t } from "@/lib/i18n";
import type { CameraAvailability } from "../../../hooks/useCameraAvailability";

interface Props {
  availability: CameraAvailability;
  /** An upload is already under way. */
  busy: boolean;
  onClick: () => void;
}

/** Why the button is greyed out, shown on hover; none while it is still looking. */
const UNAVAILABLE_REASON: Record<CameraAvailability, string | null> = {
  checking: null,
  available: null,
  none: "Patient:Image:NoCamera",
  insecure: "Patient:Image:CameraInsecure",
};

/**
 * "Chụp ảnh", beside "Tải ảnh" (BA request, not in the reference): opens the
 * camera on the page. With no camera on the machine it stays, greyed out, and
 * says why on hover — a disabled button swallows the mouse, so the tooltip
 * hangs on the slot around it.
 */
export function PatientImageCaptureButton({ availability, busy, onClick }: Props) {
  const reason = UNAVAILABLE_REASON[availability];

  return (
    <Tooltip title={reason ? t(reason) : null} trigger={["hover", "focus"]}>
      <span className="pi-capture-slot" tabIndex={reason ? 0 : undefined}>
        <button
          type="button"
          className="pi-upload"
          disabled={busy || availability !== "available"}
          onClick={onClick}
        >
          <Camera size={28} strokeWidth={1.5} />
          <span>{t("Patient:Image:Capture")}</span>
        </button>
      </span>
    </Tooltip>
  );
}
