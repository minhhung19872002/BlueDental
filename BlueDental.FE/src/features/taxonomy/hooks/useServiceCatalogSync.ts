import { useCallback } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useSyncServiceCatalog,
  type ServiceCatalogSyncResultDto,
  type SyncServiceCatalogInput,
} from "../api/clinicIntegrationApi";
import { syncToasts } from "../serviceCatalogSync";

/**
 * Sends a selection to the partner and reports it the way the reference does:
 * the toasts come from the answer, never before it. The caller decides what
 * happens next (the toolbar opens the result dialog, the service dialog closes).
 */
export function useServiceCatalogSync(branchId: string) {
  const mutation = useSyncServiceCatalog(branchId);
  const { mutate } = mutation;

  const sync = useCallback(
    (input: SyncServiceCatalogInput, onSynced?: (result: ServiceCatalogSyncResultDto) => void) => {
      mutate(input, {
        onSuccess: (result) => {
          const { reasons, outcome } = syncToasts(result);
          if (reasons.length > 0) {
            toast.warning(t("Taxonomy:Sync:Toast:Skipped", reasons.length), { description: reasons.join("; ") });
          }
          if (outcome?.kind === "error") toast.error(t(outcome.key, ...outcome.params));
          if (outcome?.kind === "success") toast.success(t(outcome.key, ...outcome.params));
          onSynced?.(result);
        },
      });
    },
    [mutate],
  );

  return { sync, isSyncing: mutation.isPending };
}
