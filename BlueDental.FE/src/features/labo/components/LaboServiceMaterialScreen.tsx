import { useState } from "react";
import { Drawer } from "antd";
import { toast } from "sonner";
import {
  useLaboMaterialCommands,
  useLaboMaterialList,
  type LaboMaterialDto,
} from "../api/laboCatalogApi";
import { useLaboMaterialGroups } from "../api/laboMaterialGroups";
import { LaboMaterialDialog } from "./LaboMaterialDialog";
import { LaboMaterialHeader } from "./LaboMaterialHeader";
import { LaboMaterialTable } from "./LaboMaterialTable";
import { useServiceGroupEditor } from "./useServiceGroupEditor";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { GroupPanel } from "@/components/GroupPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";

interface LaboServiceMaterialScreenProps {
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

/**
 * Dịch vụ Labo (BA P1011, P1311): the Dịch vụ on the left — the three fixed
 * ones, locked, then those the branch adds, renames and deletes — and the
 * Vật liệu of the selected one on the right. A group made before P1011 stays
 * in the database for old orders but is not listed.
 */
export function LaboServiceMaterialScreen({ canCreate, canUpdate, canDelete }: LaboServiceMaterialScreenProps) {
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null);
  const [groupKeyword, setGroupKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; material: LaboMaterialDto | null }>({
    open: false,
    material: null,
  });
  const [pendingDelete, setPendingDelete] = useState<LaboMaterialDto | null>(null);

  const pagination = useTablePagination(20);
  const debouncedGroupKeyword = useDebounce(groupKeyword, 400);
  const debouncedKeyword = useDebounce(keyword, 400);

  const groupsQuery = useLaboMaterialGroups(debouncedGroupKeyword);
  const { groups } = groupsQuery;
  // A group is always selected: the one picked while it is still listed,
  // otherwise the first.
  const group = groups.find((one) => one.id === pickedGroupId) ?? groups[0];

  const materialsQuery = useLaboMaterialList(
    {
      taxonomyId: group?.id,
      filter: debouncedKeyword,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    group !== undefined,
  );
  const commands = useLaboMaterialCommands();
  const groupEditor = useServiceGroupEditor({ canCreate, canUpdate, canDelete });

  const selectGroup = (id: string) => {
    setPickedGroupId(id);
    pagination.resetToFirstPage();
    setGroupsOpen(false);
  };

  const handleSearch = (value: string) => {
    setKeyword(value.slice(0, 100));
    pagination.resetToFirstPage();
  };

  const handleToggleActive = async (row: LaboMaterialDto, isActive: boolean) => {
    try {
      await commands.setActive.mutateAsync({ id: row.id, isActive });
      toast.success(t("Common:Updated"));
    } catch {
      // queryClient reports the failure; the switch falls back to the stored value.
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await commands.remove.mutateAsync(pendingDelete.id);
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const groupPanel = (
    <GroupPanel
      title={t("Labo:Material:PanelTitle")}
      subtitle={t("Labo:Material:PanelSubtitle")}
      groups={groups.map((one) => ({ ...one, isSystem: one.code !== undefined }))}
      isLoading={groupsQuery.isLoading}
      isSearching={groupsQuery.isFetching && !groupsQuery.isLoading}
      keyword={groupKeyword}
      onKeywordChange={setGroupKeyword}
      selectedId={group?.id ?? null}
      onSelect={selectGroup}
      onCreate={groupEditor.onCreate}
      onRename={groupEditor.onRename}
      onDelete={groupEditor.onDelete}
      createLabel={t("Labo:MaterialGroup:CreateTitle")}
      // Order comes from the fixed groups, then each Dịch vụ's priority.
      onReorder={() => undefined}
      searchPlaceholder={t("Labo:Material:SearchGroup")}
      emptyText={t("Labo:Material:NoGroup")}
      notFoundText={t("Labo:Material:NoGroupFound")}
    />
  );

  const togglingId = commands.setActive.isPending ? commands.setActive.variables?.id : undefined;

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-shell">
        <aside className="bd-labo-aside">{groupPanel}</aside>
        <Drawer
          open={groupsOpen}
          onClose={() => setGroupsOpen(false)}
          placement="left"
          size={288}
          title={t("Labo:Material:PanelTitle")}
          className="bd-group-drawer"
          styles={{ body: { padding: 0 } }}
        >
          {groupPanel}
        </Drawer>

        <div className="bd-labo-main">
          <LaboMaterialHeader
            group={group}
            keyword={keyword}
            onKeywordChange={handleSearch}
            onOpenGroups={() => setGroupsOpen(true)}
            onCreate={canCreate ? () => setDialog({ open: true, material: null }) : undefined}
          />
          <div className="bd-cat-body">
            <div className="bd-cat-card">
              <LaboMaterialTable
                rows={group ? (materialsQuery.data?.items ?? []) : []}
                loading={materialsQuery.isFetching}
                emptyText={debouncedKeyword ? t("Common:NoResultsMatch") : t("Common:NoData")}
                pagination={pagination.buildConfig(
                  group ? (materialsQuery.data?.totalCount ?? 0) : 0,
                  countedTotal(t("Labo:Noun:Material")),
                )}
                togglingId={togglingId}
                onToggleActive={canUpdate ? (row, active) => void handleToggleActive(row, active) : undefined}
                onEdit={canUpdate ? (material) => setDialog({ open: true, material }) : undefined}
                onDelete={canDelete ? setPendingDelete : undefined}
              />
            </div>
          </div>
        </div>
      </div>

      <LaboMaterialDialog
        open={dialog.open}
        material={dialog.material}
        groups={groups}
        defaultTaxonomyId={group?.id}
        onClose={() => setDialog({ open: false, material: null })}
      />
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("Labo:Noun:Material")}
        name={pendingDelete?.name ?? ""}
        pending={commands.remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
      {groupEditor.dialogs}
    </div>
  );
}
