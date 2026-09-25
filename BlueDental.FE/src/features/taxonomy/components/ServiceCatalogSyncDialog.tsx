import { useEffect } from "react";
import { Button, Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t, tRich } from "@/lib/i18n";
import { useServiceCatalogGroups, type SyncServiceCatalogInput } from "../api/clinicIntegrationApi";
import { useServiceSyncSelection } from "../hooks/useServiceSyncSelection";
import { ServiceSyncGroupRow } from "./ServiceSyncGroupRow";

interface Props {
  open: boolean;
  branchId: string;
  syncing: boolean;
  onClose: () => void;
  onConfirm: (input: SyncServiceCatalogInput) => void;
}

/**
 * "Chọn danh mục dịch vụ cần đồng bộ" — the branch's service groups, each
 * unfoldable to its services, searched in the browser by name or code. The
 * tree is fetched when the dialog opens; the ticks are cleared on close.
 */
export function ServiceCatalogSyncDialog({ open, branchId, syncing, onClose, onConfirm }: Props) {
  const { data: groups = [], isFetching } = useServiceCatalogGroups(branchId, open);
  const selection = useServiceSyncSelection(groups);
  const { reset } = selection;

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleConfirm = () => {
    onConfirm(selection.input);
    onClose();
  };

  return (
    <AppDialog
      open={open}
      title={t("Taxonomy:Sync:DialogTitle")}
      subtitle={t("Taxonomy:Sync:DialogSubtitle")}
      width={672}
      className="bd-sync-dialog"
      titleExtra={
        <Button disabled={isFetching || selection.syncableCount === 0} onClick={selection.handleToggleAll}>
          {selection.allSelected ? t("Taxonomy:Sync:UnselectAll") : t("Taxonomy:Sync:SelectAll")}
        </Button>
      }
      footerLeft={
        <span className="bd-sync-dialog__count">
          {tRich("Taxonomy:Sync:SelectedCount", selection.selectedCount)}
        </span>
      }
      cancelLabel={t("Taxonomy:Sync:Cancel")}
      saveLabel={t("Taxonomy:Sync:Confirm")}
      saveIcon={null}
      canSave={selection.selectedCount > 0}
      saving={syncing}
      onSave={handleConfirm}
      onClose={onClose}
    >
      <Input
        type="search"
        prefix={<SearchOutlined />}
        placeholder={t("Taxonomy:Sync:SearchPlaceholder")}
        aria-label={t("Taxonomy:Sync:SearchPlaceholder")}
        value={selection.search}
        disabled={isFetching}
        onChange={(event) => selection.setSearch(event.target.value)}
      />

      <div className="bd-sync-dialog__list">
        <SyncGroupList
          loading={isFetching}
          hasGroups={groups.length > 0}
          selection={selection}
        />
      </div>
    </AppDialog>
  );
}

function SyncGroupList({
  loading,
  hasGroups,
  selection,
}: {
  loading: boolean;
  hasGroups: boolean;
  selection: ReturnType<typeof useServiceSyncSelection>;
}) {
  if (loading) {
    return (
      <div className="bd-sync-dialog__loading">
        <Spin />
      </div>
    );
  }
  if (!hasGroups) return <p className="bd-sync-dialog__empty">{t("Taxonomy:Sync:NoGroups")}</p>;
  if (selection.visibleGroups.length === 0) {
    return <p className="bd-sync-dialog__empty">{t("Taxonomy:Sync:NoMatch")}</p>;
  }

  return selection.visibleGroups.map((group) => (
    <ServiceSyncGroupRow
      key={group.taxonomyId}
      group={group}
      selected={selection.selected}
      open={selection.isExpanded(group.taxonomyId)}
      onToggleGroup={selection.handleToggleGroup}
      onToggleService={selection.handleToggleService}
      onOpenChange={selection.handleExpandedChange}
    />
  ));
}
