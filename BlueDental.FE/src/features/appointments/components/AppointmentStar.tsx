import type { ReactElement } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { APPOINTMENT_STARS, type AppointmentStarKey } from "../types/appointment";

/**
 * "Gán sao" (R-1240, BA 2026-11-16): four stars, each its own shape as well
 * as its own colour, so two of them never read alike even side by side on a
 * busy calendar. The colour comes from the `appt-star--<key>` class.
 */
const STAR_SHAPES: Record<AppointmentStarKey, ReactElement> = {
  // Sao năm cánh — the classic star, corners softened.
  purple: (
    <path
      className="appt-star__body"
      d="M12 2.8l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 16.84l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9z"
    />
  ),
  // Sao lấp lánh — four curved points.
  green: (
    <path
      className="appt-star__body"
      d="M12 1.8C12.9 7.7 16.3 11.1 22.2 12 16.3 12.9 12.9 16.3 12 22.2 11.1 16.3 7.7 12.9 1.8 12 7.7 11.1 11.1 7.7 12 1.8z"
    />
  ),
  // Sao sáu cánh.
  orange: (
    <path
      className="appt-star__body"
      d="M12 2l2.95 5.11h5.9L17.9 12l2.95 4.89h-5.9L12 22l-2.95-5.11h-5.9L6.1 12 3.15 7.11h5.9z"
    />
  ),
  // Huy hiệu — a white star on a round badge.
  red: (
    <>
      <circle className="appt-star__body" cx="12" cy="12" r="10" />
      <path
        className="appt-star__inner"
        d="M12 6.2l1.72 3.49 3.85.56-2.79 2.72.66 3.84L12 15l-3.44 1.81.66-3.84-2.79-2.72 3.85-.56z"
      />
    </>
  ),
};

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
      {STAR_SHAPES[star]}
    </svg>
  );
}

/** The star in front of a patient's name on the calendar, or nothing. */
export function AppointmentStarMark({ star }: { star: string | null | undefined }) {
  if (!isAppointmentStar(star)) return null;
  return <AppointmentStarIcon star={star} />;
}
