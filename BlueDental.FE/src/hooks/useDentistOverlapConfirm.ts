import { useCallback, useState } from "react";
import { describeApiError } from "@/lib/apiError";

/** The server's "bác sĩ đã có lịch trong khung giờ này" — a warning, not a refusal. */
export const DENTIST_OVERLAP_CODE = "BlueDental:Appointment:0002";

/** Mutation meta for a booking write whose screen asks about the overlap itself. */
export const QUIET_DENTIST_OVERLAP = { quietErrorCodes: [DENTIST_OVERLAP_CODE] } as const;

interface OverlapWarning {
  /** The server's sentence, naming the times already booked. */
  message: string;
  proceed: () => void;
  cancel?: () => void;
}

/**
 * Booking a dentist into a slot that already holds a visit is allowed once the
 * user confirms (BA 2026-10-16): the server refuses the first try with
 * Appointment:0002, the screen asks, and Xác nhận resends with
 * `allowDentistOverlap`. Hủy only closes the warning — the form keeps what
 * was typed so the time can be changed.
 */
export function useDentistOverlapConfirm() {
  const [warning, setWarning] = useState<OverlapWarning | null>(null);

  /**
   * True when `error` was the overlap warning; the dialog now asks. Confirming
   * runs `proceed`, Hủy runs `cancel` (for a screen that must undo what it showed).
   */
  const intercept = useCallback((error: unknown, proceed: () => void, cancel?: () => void): boolean => {
    const info = describeApiError(error);
    if (info.code !== DENTIST_OVERLAP_CODE) return false;
    setWarning({ message: info.message, proceed, cancel });
    return true;
  }, []);

  const handleConfirm = useCallback(() => {
    setWarning(null);
    warning?.proceed();
  }, [warning]);

  const handleClose = useCallback(() => {
    setWarning(null);
    warning?.cancel?.();
  }, [warning]);

  return {
    intercept,
    dialog: { message: warning?.message, onConfirm: handleConfirm, onClose: handleClose },
  };
}
