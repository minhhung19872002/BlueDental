import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { APPOINTMENT_STARS, type AppointmentStarKey } from "../types/appointment";

/**
 * "Gán sao" (R-1240, BA 2026-11-16): one five-point star for every key — BA:
 * "để hình ngôi sao 5 cánh hết á". Only the colour tells them apart; it comes
 * from the `appt-star--<key>` class.
 */
const STAR_PATH =
  "M12 2.8l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 16.84l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9z";

const STAR_LABEL_KEYS: Record<AppointmentStarKey, string> = {
  purple: "Appointment:Star:Purple",
  green: "Appointment:Star:Green",
  orange: "Appointment:Star:Orange",
  red: "Appointment:Star:Red",
};

export function isAppointmentStar(value: string | null | undefined): value is AppointmentStarKey {
  return APPOINTMENT_STARS.some((key) => key === value);
}

/** "Sao tím", or null for a value that is not one of the four stars. */
export function appointmentStarLabel(value: string | null | undefined): string | null {
  return isAppointmentStar(value) ? t(STAR_LABEL_KEYS[value]) : null;
}

interface IconProps {
  star: AppointmentStarKey;
  /** "sm" sits in front of a name on the calendar; "lg" is the dialog's button. */
  size?: "sm" | "lg";
  /** Read out as an image; leave false when the surrounding button already names it. */
  labelled?: boolean;
}

export function AppointmentStarIcon({ star, size = "sm", labelled = true }: IconProps) {
  const label = t(STAR_LABEL_KEYS[star]);
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("appt-star", `appt-star--${star}`, `appt-star--${size}`)}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? label : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled && <title>{label}</title>}
      <path className="appt-star__body" d={STAR_PATH} />
    </svg>
  );
}

/** The star in front of a patient's name on the calendar, or nothing. */
export function AppointmentStarMark({ star }: { star: string | null | undefined }) {
  if (!isAppointmentStar(star)) return null;
  return <AppointmentStarIcon star={star} />;
}
