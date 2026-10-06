import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useStaffPenaltyCommands, type StaffPenaltyDto, type StaffPenaltyInput } from "../api/staffPenaltyApi";

/** Which dialog is open, and on which row. */
type Pending =
  | { kind: "none" }
  | { kind: "form"; penalty: StaffPenaltyDto | null }
  | { kind: "view" | "approve" | "cancel" | "delete"; penalty: StaffPenaltyDto };

/**
 * The row actions of Chế tài. Each one waits for the server before it toasts
 * and closes; a refusal is reported by the query client and leaves the dialog
 * open to retry.
 */
export function usePenaltyActions() {
  const commands = useStaffPenaltyCommands();
  const [pending, setPending] = useState<Pending>({ kind: "none" });
  const close = () => setPending({ kind: "none" });

  const run = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work();
      toast.success(message);
      close();
    } catch {
      // queryClient reports the failure.
    }
  };

  const submitForm = (input: StaffPenaltyInput) => {
    if (pending.kind !== "form") return;
    const editing = pending.penalty;
    void run(
      () => (editing ? commands.update.mutateAsync({ id: editing.id, input }) : commands.create.mutateAsync(input)),
      t(editing ? "Common:Updated" : "StaffPenalty:Created"),
    );
  };

  const confirm = (reason?: string) => {
    if (pending.kind === "approve") {
      void run(() => commands.approve.mutateAsync(pending.penalty.id), t("StaffPenalty:Approved"));
    } else if (pending.kind === "cancel" && reason) {
      void run(() => commands.cancel.mutateAsync({ id: pending.penalty.id, reason }), t("StaffPenalty:Cancelled"));
    } else if (pending.kind === "delete") {
      void run(() => commands.remove.mutateAsync(pending.penalty.id), t("Common:Deleted"));
    }
  };

  return {
    pending,
    close,
    openCreate: () => setPending({ kind: "form", penalty: null }),
    handlers: {
      onView: (penalty: StaffPenaltyDto) => setPending({ kind: "view", penalty }),
      onEdit: (penalty: StaffPenaltyDto) => setPending({ kind: "form", penalty }),
      onApprove: (penalty: StaffPenaltyDto) => setPending({ kind: "approve", penalty }),
      onCancel: (penalty: StaffPenaltyDto) => setPending({ kind: "cancel", penalty }),
      onDelete: (penalty: StaffPenaltyDto) => setPending({ kind: "delete", penalty }),
    },
    submitForm,
    confirm,
    saving: commands.create.isPending || commands.update.isPending,
    confirming: commands.approve.isPending || commands.cancel.isPending || commands.remove.isPending,
  };
}
