import { useId } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { APPOINTMENT_STARS, type AppointmentStarKey } from "../types/appointment";
import { AppointmentStarIcon, appointmentStarLabel, isAppointmentStar } from "./AppointmentStar";

interface Props {
  value: string | null;
  onChange: (star: AppointmentStarKey | null) => void;
}

/**
 * "Gán sao" (R-1240) in place of "Màu lịch hẹn". No checkbox (BA 2026-11-16):
 * a click on a star assigns it, a click on the star already assigned takes it
 * off. Each star is a toggle button, so a reader hears which one is pressed.
 */
export function AppointmentStarPicker({ value, onChange }: Props) {
  const labelId = useId();
  const selected = isAppointmentStar(value) ? value : null;

  return (
    <div className="appt-field">
      <span id={labelId} className="appt-field-label">
        {t("Appointment:Form:AssignStar")}
      </span>
      <div role="group" aria-labelledby={labelId} className="appt-star-row">
        {APPOINTMENT_STARS.map((star) => (
          <button
            key={star}
            type="button"
            aria-pressed={selected === star}
            aria-label={appointmentStarLabel(star) ?? star}
            title={appointmentStarLabel(star) ?? star}
            className={cn(
              "appt-star-option",
              `appt-star-option--${star}`,
              selected === star && "appt-star-option--selected",
            )}
            onClick={() => onChange(selected === star ? null : star)}
          >
            <AppointmentStarIcon star={star} size="lg" labelled={false} />
          </button>
        ))}
      </div>
      <span className="appt-star-hint">{t("Appointment:Form:AssignStarHint")}</span>
    </div>
  );
}
