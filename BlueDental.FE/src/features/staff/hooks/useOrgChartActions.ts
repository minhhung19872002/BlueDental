import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useOrgChartCommands,
  type CreateOrgUnitInput,
  type OrgUnitDto,
  type OrgUnitInput,
} from "../api/orgChartApi";

/** Which dialog is open, and on which unit. */
export type OrgChartPending =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit" | "delete"; unit: OrgUnitDto }
  | { kind: "assign"; unitId: string | null }
  | { kind: "rootHead" }
  | { kind: "history" };

/**
 * The writes of Sơ đồ tổ chức. Each waits for the server before it toasts and
 * closes. A refused unit save stays open with the reason in its banner; the
 * other refusals are reported by the query client.
 */
export function useOrgChartActions() {
  const commands = useOrgChartCommands();
  const [pending, setPending] = useState<OrgChartPending>({ kind: "none" });
  const close = () => {
    commands.create.reset();
    commands.update.reset();
    setPending({ kind: "none" });
  };

  const run = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work();
      toast.success(message);
      setPending({ kind: "none" });
    } catch {
      // Shown by the dialog banner or the query client.
    }
  };

  const saveUnit = (input: CreateOrgUnitInput | OrgUnitInput) => {
    if (pending.kind === "edit") {
      const id = pending.unit.id;
      void run(() => commands.update.mutateAsync({ id, input }), t("OrgChart:Toast:Updated"));
    } else if (pending.kind === "create" && "kind" in input) {
      void run(() => commands.create.mutateAsync(input), t("OrgChart:Toast:Created"));
    }
  };

  const removeUnit = () => {
    if (pending.kind !== "delete") return;
    const id = pending.unit.id;
    void run(() => commands.remove.mutateAsync(id), t("OrgChart:Toast:Deleted"));
  };

  const assign = (orgUnitId: string, staffIds: string[]) =>
    void run(() => commands.assign.mutateAsync({ orgUnitId, staffIds }), t("OrgChart:Toast:Assigned"));

  const changeRootHead = (headStaffId: string | null) =>
    void run(() => commands.changeRootHead.mutateAsync(headStaffId), t("OrgChart:Toast:HeadChanged"));

  return {
    pending,
    open: setPending,
    close,
    saveUnit,
    removeUnit,
    assign,
    changeRootHead,
    saveError: commands.create.error ?? commands.update.error,
    saving: commands.create.isPending || commands.update.isPending,
    assigning: commands.assign.isPending || commands.changeRootHead.isPending,
    deleting: commands.remove.isPending,
  };
}
