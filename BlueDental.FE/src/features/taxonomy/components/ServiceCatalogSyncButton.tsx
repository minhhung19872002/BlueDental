import { useState } from "react";
import { Button } from "antd";
import { DatabaseOutlined, LoadingOutlined } from "@ant-design/icons";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { useClinicSyncFlags, type ServiceCatalogSyncResultDto } from "../api/clinicIntegrationApi";
import { useServiceCatalogSync } from "../hooks/useServiceCatalogSync";
import { ServiceCatalogSyncDialog } from "./ServiceCatalogSyncDialog";
import { ServiceCatalogSyncResultDialog } from "./ServiceCatalogSyncResultDialog";

interface Props {
  branchId: string;
  /** A sync goes to one branch's partner, so it waits while every branch is in view. */
  disabled: boolean;
}

/**
 * "Đồng bộ danh mục dịch vụ" on the Dịch vụ tab. Shown only when the branch's
 * link to its partner is active and service sync is switched on — the
 * reference's `isClinicIntegrationSyncEnabled(flags, "service-catalog")` — and
 * only to an account that may edit services.
 */
export function ServiceCatalogSyncButton({ branchId, disabled }: Props) {
  const { canUpdate } = useAbility("catalogService");
  const flags = useClinicSyncFlags(branchId, canUpdate);
  const { sync, isSyncing } = useServiceCatalogSync(branchId);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ServiceCatalogSyncResultDto | null>(null);

  if (!canUpdate || !flags.data?.serviceCatalogSyncEnabled) return null;

  return (
    <>
      <Button
        icon={<DatabaseOutlined />}
        disabled={disabled || isSyncing}
        aria-busy={isSyncing}
        onClick={() => setOpen(true)}
      >
        {isSyncing ? <LoadingOutlined aria-label={t("Taxonomy:Sync:Syncing")} /> : t("Taxonomy:Sync:Button")}
      </Button>

      <ServiceCatalogSyncDialog
        open={open}
        branchId={branchId}
        syncing={isSyncing}
        onClose={() => setOpen(false)}
        onConfirm={(input) => sync(input, setResult)}
      />

      <ServiceCatalogSyncResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}
