import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useTicketCommands, type TicketFilter } from "../api/ticketApi";

/** Chuyển ticket (BA 8.3): the dialog's open state and the transfer of whatever `filter` matches. */
export function useTicketTransfer(filter: TicketFilter) {
  const [open, setOpen] = useState(false);
  const { transfer } = useTicketCommands();

  const submit = async (assigneeIds: string[]) => {
    try {
      const result = await transfer.mutateAsync({ filter, assigneeIds });
      toast.success(t("Ticket:Transferred", result.transferred, result.matched));
      setOpen(false);
    } catch {
      // queryClient reports the failure.
    }
  };

  return {
    open,
    show: () => setOpen(true),
    close: () => setOpen(false),
    submit,
    pending: transfer.isPending,
  };
}
