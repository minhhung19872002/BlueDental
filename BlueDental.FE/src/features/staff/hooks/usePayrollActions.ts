import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { extractApiError } from "@/lib/apiError";
import {
  exportPayroll,
  usePayrollCommands,
  type PayrollEntry,
  type PayrollEntryInput,
  type PayrollPeriod,
  type PayrollTermsInput,
} from "../api/payrollApi";

type Pending =
  | { kind: "none" }
  | { kind: "entry"; entry: PayrollEntry }
  | { kind: "terms" }
  | { kind: "finalize" }
  | { kind: "delete" };

/**
 * What the Bảng lương buttons do. Each command waits for the server before it
 * toasts and closes; a refusal (a finalized sheet, a duplicate month) is
 * reported by the query client with the server's words and leaves the dialog
 * open to retry.
 */
export function usePayrollActions(period: PayrollPeriod | undefined) {
  const commands = usePayrollCommands();
  const [pending, setPending] = useState<Pending>({ kind: "none" });
  const close = () => setPending({ kind: "none" });

  const run = async (work: () => Promise<unknown>, message: string, closeAfter = true) => {
    try {
      await work();
      toast.success(message);
      if (closeAfter) close();
    } catch {
      // queryClient reports the failure.
    }
  };

  const create = (year: number, month: number) =>
    void run(() => commands.create.mutateAsync({ year, month }), t("Payroll:Created"), false);

  const recalculate = () =>
    period && void run(() => commands.recalculate.mutateAsync(period.id), t("Payroll:Recalculated"), false);

  const saveEntry = (input: PayrollEntryInput) => {
    if (!period || pending.kind !== "entry") return;
    const staffId = pending.entry.staffId;
    void run(() => commands.updateEntry.mutateAsync({ id: period.id, staffId, input }), t("Payroll:Saved"));
  };

  const saveTerms = (input: PayrollTermsInput) =>
    period && void run(() => commands.updateTerms.mutateAsync({ id: period.id, input }), t("Payroll:Saved"));

  const confirm = () => {
    if (!period) return;
    if (pending.kind === "finalize") void run(() => commands.finalize.mutateAsync(period.id), t("Payroll:Finalized"));
    if (pending.kind === "delete") void run(() => commands.remove.mutateAsync(period.id), t("Payroll:Deleted"));
  };

  const download = () => {
    if (period) exportPayroll(period.id).catch((error: unknown) => notifyError(extractApiError(error)));
  };

  return {
    pending,
    close,
    open: setPending,
    create,
    recalculate,
    saveEntry,
    saveTerms,
    confirm,
    download,
    creating: commands.create.isPending,
    recalculating: commands.recalculate.isPending,
    saving: commands.updateEntry.isPending || commands.updateTerms.isPending,
    confirming: commands.finalize.isPending || commands.remove.isPending,
  };
}
