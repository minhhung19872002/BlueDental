import { useCallback, useEffect, useState } from "react";
import { useAbility } from "@/hooks/useAbility";
import { useClinicSyncFlags } from "../api/clinicIntegrationApi";
import { useServiceCatalogSync } from "./useServiceCatalogSync";

/**
 * The service dialog's part in the partner sync, as on the reference: with
 * sync on, an edit shows a "Lưu ý" to sync afterwards, and a save keeps the
 * dialog open with "Đồng bộ dịch vụ này" in place of "Lưu". With sync off the
 * dialog behaves as it always did and closes on save.
 */
export function useServiceDialogSync(branchId: string, open: boolean) {
  const { canUpdate } = useAbility("catalogService");
  const flags = useClinicSyncFlags(branchId, open && canUpdate);
  const { sync, isSyncing } = useServiceCatalogSync(branchId);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSavedId(null);
  }, [open]);

  const syncEnabled = canUpdate && Boolean(flags.data?.serviceCatalogSyncEnabled);

  /** Sends only the service just saved; the dialog closes once the partner has answered. */
  const syncSaved = useCallback(
    (onSynced: () => void) => {
      if (savedId) sync({ serviceIds: [savedId] }, onSynced);
    },
    [savedId, sync],
  );

  return { syncEnabled, savedId, markSaved: setSavedId, isSyncing, syncSaved };
}
