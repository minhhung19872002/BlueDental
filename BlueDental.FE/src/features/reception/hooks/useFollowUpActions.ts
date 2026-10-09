import { toast } from "sonner";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useBookFollowUp, useRebookUndated } from "../api/receptionMutations";
import type { FollowUpPicker } from "./useFollowUpPicker";
import type { BookedOutcome } from "../types/reception";

const SUCCESS_TEXT: Record<BookedOutcome, string> = {
  FollowUp: "Reception:FollowUpSuccess",
  Revisit: "Reception:RevisitSuccess",
};

/**
 * The two ways out of "Chọn lịch hẹn tiếp theo": book the picked slot, or
 * "Hẹn lại - Chưa chốt ngày" — save the outcome with no date and leave the
 * date to customer care (owner, 2026-10-09).
 */
export function useFollowUpActions(
  appointmentId: string,
  outcome: BookedOutcome,
  picker: FollowUpPicker,
  onClose: () => void,
) {
  const bookMutation = useBookFollowUp();
  const rebookMutation = useRebookUndated();

  const handleConfirm = () => {
    const input = picker.buildInput();
    if (!input) return;
    bookMutation.mutate(
      { id: appointmentId, input, outcome },
      {
        onSuccess: () => {
          // No onClose: the page hides the picker once the card shows the booking.
          toast.success(t(SUCCESS_TEXT[outcome], dayjs(input.slotStart).format("HH:mm DD/MM/YYYY")));
        },
      },
    );
  };

  const handleRebookUndated = () => {
    rebookMutation.mutate(
      { id: appointmentId, input: picker.buildUndatedInput(), outcome },
      {
        // The card never gets a date here, so the picker is closed by hand.
        onSuccess: () => {
          toast.success(t("Reception:RebookUndatedSuccess"));
          onClose();
        },
      },
    );
  };

  return {
    handleConfirm,
    handleRebookUndated,
    confirming: bookMutation.isPending,
    rebooking: rebookMutation.isPending,
    pending: bookMutation.isPending || rebookMutation.isPending,
  };
}
