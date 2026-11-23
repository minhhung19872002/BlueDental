import type { MouseEvent } from "react";
import { Tooltip } from "antd";
import { Check, Lock } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

interface Props {
  image: PatientImageViewModel;
  /** The column is being selected in. */
  active: boolean;
  picked: boolean;
  onToggle: (extend: boolean) => void;
}

/**
 * The tick in a tile's bottom-right corner (R-1277).
 *
 * Before a selection it is a real checkbox, shown on hover, and ticking it
 * starts one. Once the column is selecting, the whole picture is the control,
 * so the tick only shows the state and lets clicks through to the picture. A
 * picture that may not be deleted shows a lock instead, with the reason.
 */
export function PatientImageCardTick({ image, active, picked, onToggle }: Props) {
  if (!image.deletable) {
    if (!active) return null;
    return (
      <Tooltip title={t("Patient:Image:SelectLocked")}>
        <span className="pi-card-tick pi-card-tick--locked" aria-label={t("Patient:Image:SelectLocked")}>
          <Lock size={11} />
        </span>
      </Tooltip>
    );
  }

  const className = ["pi-card-tick", picked && "pi-card-tick--on"].filter(Boolean).join(" ");

  if (active) {
    return (
      <span className={className} aria-hidden="true">
        {picked && <Check size={12} strokeWidth={3} />}
      </span>
    );
  }

  const handleClick = (event: MouseEvent) => onToggle(event.shiftKey);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={false}
      className={`${className} pi-card-tick--offer`}
      aria-label={t("Patient:Image:SelectFile", image.fileName)}
      onClick={handleClick}
    />
  );
}
