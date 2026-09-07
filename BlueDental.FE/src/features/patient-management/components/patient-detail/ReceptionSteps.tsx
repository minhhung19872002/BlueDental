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

/**
 * Tiếp nhận — Đã đến → Đang khám → Hoàn tất.
 *
 * Each step is a button in the reference and only the **next** one can be
 * pressed: the other two are disabled, so the appointment cannot skip a step or
 * walk backwards. Pressing one stamps its time, which is why a step that has
 * not been reached reads "--:--".
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
      await api.post(`/v1/app/appointments/${appointment.id}/${RECEPTION_FLOW[index]}`);
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
          <li key={label} className={done ? "reached" : undefined}>
            <button
              type="button"
              disabled={!next || busy}
              aria-current={next ? "step" : undefined}
              onClick={() => void advance(index)}
            >
              <span className="pd-appt-step-dot">{index + 1}</span>
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
