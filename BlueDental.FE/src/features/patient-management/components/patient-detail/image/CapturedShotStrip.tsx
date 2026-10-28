import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { CapturedShot } from "../../../hooks/useCapturedShots";

interface Props {
  shots: CapturedShot[];
  /** The shots are being uploaded: none can be taken back. */
  busy: boolean;
  onRemove: (shot: CapturedShot) => void;
}

/**
 * The shots waiting to go up, each with a × to take it back. Past two rows the
 * strip scrolls, and a new shot scrolls it to the end so the desk sees it.
 */
export function CapturedShotStrip({ shots, busy, onRemove }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const shownCount = useRef(shots.length);
  const count = shots.length;

  useEffect(() => {
    const list = listRef.current;
    if (list && count > shownCount.current) list.scrollTop = list.scrollHeight;
    shownCount.current = count;
  }, [count]);

  if (count === 0) {
    return <p className="pi-shots-empty">{t("Patient:Image:NoShots")}</p>;
  }

  return (
    <ul ref={listRef} className="pi-shots" aria-label={t("Patient:Image:Shots")}>
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
