import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatClock } from "@/utils/format";
import { RECEPTION_FLOW, SERVER_STATUS } from "@/features/appointments/api/appointmentAdapters";
import type { Appointment } from "@/features/appointments/types/appointment";

interface Props {
  appointment: Appointment;
  onAdvanced: () => void;
}

/** How far the appointment has walked: 0 = booked, 3 = finished. */
function reachedUpTo(statusCode: number): number {
  if (statusCode === SERVER_STATUS.Completed) return 3;
  if (statusCode === SERVER_STATUS.InProgress) return 2;
  if (statusCode === SERVER_STATUS.CheckedIn) return 1;
  return 0;
}

const LABELS = ["Đã đến", "Đang khám", "Hoàn tất"] as const;

/** The tick a reached step wears in place of its number. */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Tiếp nhận — Đã đến → Đang khám → Hoàn tất.
 *
 * Each step is a button in the reference and only the **next** one can be
 * pressed: the other two are disabled, so the appointment cannot skip a step or
 * walk backwards. Pressing one stamps its time, which is why a step that has
 * not been reached reads "--:--".
 *
 * The three steps carry three **different** colours once reached — blue, amber,
 * green — and the rail leading into a step takes that step's colour, so the row
 * reads as progress rather than as one repeated tint. Each step renders both
 * halves of its rail, with the outer edges hidden, exactly as the reference
 * builds it.
 */
export function ReceptionSteps({ appointment, onAdvanced }: Props) {
  const [busy, setBusy] = useState(false);
  const reached = reachedUpTo(appointment.statusCode);

  const stamps: (string | null)[] = [
    reached >= 1 ? (appointment.checkedInAt ?? null) : null,
    reached >= 2 ? (appointment.startedAt ?? null) : null,
    reached >= 3 ? (appointment.completedAt ?? null) : null,
  ];

  const advance = async (index: number) => {
    setBusy(true);
    try {
      const step = RECEPTION_FLOW[index];
      /*
       * `complete` binds a body — [FromBody] CompleteAppointmentDto — while
       * check-in and start take none. Posting nothing left step three failing
       * model binding, which is why Hoàn tất could never be pressed. The note is
       * sent back as it stands because Appointment.Complete assigns Notes
       * unconditionally, so omitting it would erase the appointment's note.
       */
      await api.post(
        `/v1/app/appointments/${appointment.id}/${step}`,
        step === "complete" ? { notes: appointment.notes ?? null } : undefined,
      );
      toast.success(t("Đã cập nhật tiếp nhận"));
      onAdvanced();
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ol className="pd-appt-steps">
      {LABELS.map((label, index) => {
        const done = reached >= index + 1;
        // Only the step immediately after the one reached is live.
        const next = reached === index;

        return (
          <li key={label} data-step={index + 1} className={done ? "reached" : undefined}>
            <button
              type="button"
              disabled={!next || busy}
              aria-current={next ? "step" : undefined}
              onClick={() => void advance(index)}
            >
              <span className="pd-appt-step-rail">
                <i className="pd-appt-step-rail-in" />
                <span className="pd-appt-step-dot">{done ? <CheckIcon /> : index + 1}</span>
                <i className="pd-appt-step-rail-out" />
              </span>
              <span className="pd-appt-step-label">{t(label)}</span>
              <span className="pd-appt-step-time">
                {stamps[index] ? formatClock(stamps[index]) : "--:--"}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
