import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { CapturedShot } from "../../../hooks/useCapturedShots";

interface Props {
  shots: CapturedShot[];
  /** The shots are being uploaded: none can be taken back. */
  busy: boolean;
  onRemove: (shot: CapturedShot) => void;
}

/** The shots waiting to go up, each with a × to take it back. */
export function CapturedShotStrip({ shots, busy, onRemove }: Props) {
  if (shots.length === 0) {
    return <p className="pi-shots-empty">{t("Patient:Image:NoShots")}</p>;
  }

  return (
    <ul className="pi-shots" aria-label={t("Patient:Image:Shots")}>
      {shots.map((shot, index) => (
        <li key={shot.id} className="pi-shot" data-testid="captured-shot">
          <img src={shot.url} alt={t("Patient:Image:ShotLabel", index + 1)} />
          <button
            type="button"
            className="pi-shot-remove"
            aria-label={t("Patient:Image:RemoveShot", index + 1)}
            disabled={busy}
            onClick={() => onRemove(shot)}
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
