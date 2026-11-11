import { useCallback, useState } from "react";
import { Pagination, Spin } from "antd";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useT } from "@/lib/i18n";
import { abilityPermission } from "@/lib/permissionConstants";
import type { XrayInboxItemViewModel } from "../api/xrayInboxAdapters";
import { useDiscardXrayInboxItem } from "../api/xrayInboxMutations";
import { useXrayInboxList } from "../api/xrayInboxQueries";
import { XrayAssignDialog } from "../components/XrayAssignDialog";
import { XrayInboxCard } from "../components/XrayInboxCard";
import "../components/xray-inbox.css";

const PAGE_SIZE = 24;
const CREATE = abilityPermission("treatmentImage", "create");
const DELETE = abilityPermission("treatmentImage", "delete");

/**
 * Ảnh chưa gán hồ sơ (F-95): films the X-ray PC sent whose file named no
 * record of its branch. Staff file each one on a record, or set it aside.
 */
export function XrayInboxPage() {
  const t = useT();
  const clinicBranchId = useBranchFilter();
  const pagination = useTablePagination(PAGE_SIZE, { pageSizeOptions: [12, 24, 48, 96] });
  const list = useXrayInboxList({
    clinicBranchId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const canAssign = useAuthStore((s) => s.hasPermission(CREATE));
  const canDiscard = useAuthStore((s) => s.hasPermission(DELETE));
  const discard = useDiscardXrayInboxItem();
  const [assigning, setAssigning] = useState<XrayInboxItemViewModel | null>(null);
  const [discarding, setDiscarding] = useState<XrayInboxItemViewModel | null>(null);

  const handleDiscard = useCallback(() => {
    if (!discarding) return;
    discard.mutate(discarding.id, {
      onSuccess: () => {
        toast.success(t("XrayInbox:Discarded"));
        setDiscarding(null);
      },
    });
  }, [discard, discarding, t]);

  const items = list.data?.items ?? [];
  const total = list.data?.totalCount ?? 0;

  return (
    <div className="xi-page">
      <p className="xi-intro">{t("XrayInbox:Intro")}</p>

      {list.isLoading && <Spin className="xi-loading" />}
      {!list.isLoading && items.length === 0 && (
        <EmptyState icon="🩻" title={t("XrayInbox:Empty")} description={t("XrayInbox:EmptyHint")} />
      )}
      {items.length > 0 && (
        <div className="xi-grid">
          {items.map((item) => (
            <XrayInboxCard
              key={item.id}
              item={item}
              canAssign={canAssign}
              canDiscard={canDiscard}
              onAssign={setAssigning}
              onDiscard={setDiscarding}
            />
          ))}
        </div>
      )}
      {total > pagination.pageSize && (
        <Pagination className="xi-pagination" {...pagination.buildConfig(total)} />
      )}

      <XrayAssignDialog item={assigning} onClose={() => setAssigning(null)} />
      <ConfirmDialog
        open={discarding !== null}
        message={t("XrayInbox:DiscardConfirm", discarding?.fileName ?? "")}
        confirmLabel={t("XrayInbox:Discard")}
        pending={discard.isPending}
        onConfirm={handleDiscard}
        onClose={() => setDiscarding(null)}
      />
    </div>
  );
}
