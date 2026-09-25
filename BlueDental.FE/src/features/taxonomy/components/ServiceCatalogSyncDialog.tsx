import { useEffect } from "react";
import { Button, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { t, tRich } from "@/lib/i18n";
import { useServiceCatalogGroups, type SyncServiceCatalogInput } from "../api/clinicIntegrationApi";
import { useServiceSyncSelection } from "../hooks/useServiceSyncSelection";
import { ServiceSyncGroupList } from "./ServiceSyncGroupList";

interface Props {
  open: boolean;
  branchId: string;
  syncing: boolean;
  onClose: () => void;
  /** The caller closes the dialog once the partner has answered. */
  onConfirm: (input: SyncServiceCatalogInput) => void;
}

/**
 * "Chọn danh mục dịch vụ cần đồng bộ" — the branch's service groups, each
 * unfoldable to its services, searched in the browser by name or code. The
 * tree is fetched when the dialog opens; the ticks are cleared on close.
 *
 * The reference closes the dialog the moment "Đồng bộ" is pressed and only the
 * toolbar button spins. BlueDental keeps it open, the button spinning and the
 * picks locked, until the answer is in (CLAUDE.md §16.18) — see
 * docs/clone/pages/taxonomy.md.
 */
export function ServiceCatalogSyncDialog({ open, branchId, syncing, onClose, onConfirm }: Props) {
  const { data: groups = [], isFetching } = useServiceCatalogGroups(branchId, open);
  const selection = useServiceSyncSelection(groups);
  const { reset } = selection;

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <AppDialog
      open={open}
      title={t("Taxonomy:Sync:DialogTitle")}
      subtitle={t("Taxonomy:Sync:DialogSubtitle")}
      width={672}
      className="bd-sync-dialog"
      titleExtra={
        <Button
          disabled={isFetching || syncing || selection.syncableCount === 0}
          onClick={selection.handleToggleAll}
        >
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
      savingLabel={t("Taxonomy:Sync:Syncing")}
      saveIcon={null}
      canSave={selection.selectedCount > 0}
      saving={syncing}
      onSave={() => onConfirm(selection.input)}
      onClose={onClose}
    >
      <Input
        type="search"
        prefix={<SearchOutlined />}
        placeholder={t("Taxonomy:Sync:SearchPlaceholder")}
        aria-label={t("Taxonomy:Sync:SearchPlaceholder")}
        value={selection.search}
        disabled={isFetching || syncing}
        onChange={(event) => selection.setSearch(event.target.value)}
      />

      <ServiceSyncGroupList
        loading={isFetching}
        hasGroups={groups.length > 0}
        disabled={syncing}
        selection={selection}
      />
    </AppDialog>
  );
}
