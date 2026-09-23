import { useMemo, useState } from "react";
import { Button, Drawer, Input, Tooltip } from "antd";
import { toast } from "sonner";
import {
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useLaboMaterialCommands,
  useLaboMaterialList,
  type LaboMaterialDto,
} from "../api/laboCatalogApi";
import {
  useLaboCatalogCommands,
  useLaboCatalogOptions,
  type LaboCatalogItem,
} from "../api/laboCatalogListApi";
import { LaboMaterialDialog } from "./LaboMaterialDialog";
import { LaboMaterialGroupDialog } from "./LaboMaterialGroupDialog";
import { LABO_GROUP } from "../laboTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { GroupPanel } from "@/components/GroupPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";

/** Either a group or a material queued for the shared confirmation. */
type PendingDelete =
  | { kind: "group"; id: string; name: string }
  | { kind: "material"; id: string; name: string };

/**
 * Dịch vụ - vật liệu.
 *
 * Two panes, as the reference has them: the classification groups on the left
 * and the materials of the selected group on the right. A material belongs to
 * a group, not to a supplier — the reference's own groups are named after labs
 * but are separate records from the supplier list.
 */
interface LaboServiceMaterialScreenProps {
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function LaboServiceMaterialScreen({
  canCreate,
  canUpdate,
  canDelete,
}: LaboServiceMaterialScreenProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupKeyword, setGroupKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [groupsOpen, setGroupsOpen] = useState(false);

  const [groupDialog, setGroupDialog] = useState<{ open: boolean; group: LaboCatalogItem | null }>({
    open: false,
    group: null,
  });
  const [materialDialog, setMaterialDialog] = useState<{
    open: boolean;
    material: LaboMaterialDto | null;
  }>({ open: false, material: null });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const pagination = useTablePagination(20);
  const debouncedGroupKeyword = useDebounce(groupKeyword, 400);
  const debouncedKeyword = useDebounce(keyword, 400);

  const groupsQuery = useLaboCatalogOptions(LABO_GROUP.Material, debouncedGroupKeyword);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  const materialsQuery = useLaboMaterialList({
    taxonomyId: selectedGroupId ?? undefined,
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const groupCommands = useLaboCatalogCommands(LABO_GROUP.Material);
  const materialCommands = useLaboMaterialCommands();

  const totalCount = materialsQuery.data?.totalCount ?? 0;

  const selectGroup = (id: string) => {
    // Clicking the selected group clears it and shows every material again,
    // the way the reference's own panel toggles.
    setSelectedGroupId((current) => (current === id ? null : id));
    pagination.resetToFirstPage();
    setGroupsOpen(false);
  };

  const handleSearch = (value: string) => {
    setKeyword(value.slice(0, 100));
    pagination.resetToFirstPage();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      if (pendingDelete.kind === "group") {
        await groupCommands.remove.mutateAsync(pendingDelete.id);
        if (selectedGroupId === pendingDelete.id) setSelectedGroupId(null);
      } else {
        await materialCommands.remove.mutateAsync(pendingDelete.id);
      }
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const columns: ColumnsType<LaboMaterialDto> = [
    {
      key: "name",
      title: t("Labo:Material:Title"),
      render: (_, row) => (
        <p className="bd-cat-name">{row.name}</p>
      ),
    },
    {
      key: "taxonomyName",
      title: t("Labo:Material:GroupTitle"),
      width: 300,
      render: (_, row) =>
        row.taxonomyName ? (
          <span className="bd-cat-chip">{row.taxonomyName}</span>
        ) : (
          <span className="bd-cat-num">—</span>
        ),
    },
    {
      key: "updatedAt",
      title: t("Common:LastUpdated"),
      width: 240,
      render: (_, row) => (
        <span className="bd-cat-num">
          {formatDateTime(row.lastModificationTime ?? row.creationTime)}
        </span>
      ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            title: t("Common:Actions"),
            width: 100,
            align: "center" as const,
            fixed: "right" as const,
            render: (_: unknown, row: LaboMaterialDto) => (
              <div className="bd-cat-rowactions">
                {canUpdate && (
                  <Tooltip title={t("Common:Edit")}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={t("Common:EditAriaLabel", row.name)}
                      onClick={() => setMaterialDialog({ open: true, material: row })}
                    />
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title={t("Common:Delete")}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={t("Common:DeleteAriaLabel", row.name)}
                      onClick={() =>
                        setPendingDelete({ kind: "material", id: row.id, name: row.name })
                      }
                    />
                  </Tooltip>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const groupPanel = (
    <GroupPanel<LaboCatalogItem & { entryCount?: number }>
      title={t("Labo:Material:GroupTitle")}
      subtitle={t("Labo:Material:GroupSubtitle")}
      groups={groups.map((group) => ({ ...group, entryCount: group.itemCount }))}
      isLoading={groupsQuery.isLoading}
      isSearching={groupsQuery.isFetching && !groupsQuery.isLoading}
      keyword={groupKeyword}
      onKeywordChange={setGroupKeyword}
      selectedId={selectedGroupId}
      onSelect={selectGroup}
      onCreate={canCreate ? () => setGroupDialog({ open: true, group: null }) : undefined}
      onRename={canUpdate ? (group) => setGroupDialog({ open: true, group }) : undefined}
      onDelete={
        canDelete
          ? (group) => setPendingDelete({ kind: "group", id: group.id, name: group.name })
          : undefined
      }
      // The reference orders these groups by the priority its own dialog
      // collects, and offers no drag — so there is nothing to persist here.
      onReorder={() => undefined}
      searchPlaceholder={t("Labo:Material:SearchGroup")}
      createLabel={t("Labo:Material:AddGroup")}
      emptyText={t("Labo:Material:NoGroup")}
      notFoundText={t("Labo:Material:NoGroupFound")}
    />
  );

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-shell">
        <aside className="bd-labo-aside">{groupPanel}</aside>

        <Drawer
          open={groupsOpen}
          onClose={() => setGroupsOpen(false)}
          placement="left"
          size={288}
          title={t("Labo:Material:GroupTitle")}
          className="bd-group-drawer"
          styles={{ body: { padding: 0 } }}
        >
          {groupPanel}
        </Drawer>

        <div className="bd-labo-main">
          <div className="bd-labo-header">
            <div className="bd-labo-headgroup">
              <Button
                type="link"
                icon={<MenuOutlined />}
                className="bd-labo-groupbtn"
                onClick={() => setGroupsOpen(true)}
              >
                {t("Common:SelectGroup")}
              </Button>

              <Input
                className="bd-labo-search"
                prefix={<SearchOutlined />}
                placeholder={t("Common:SearchPlaceholder")}
                aria-label={t("Labo:Material:SearchMaterial")}
                value={keyword}
                maxLength={100}
                allowClear
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>

            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={groups.length === 0}
                onClick={() => setMaterialDialog({ open: true, material: null })}
              >
                {t("Labo:Material:Create")}
              </Button>
            )}
          </div>

          <div className="bd-cat-body">
            <div className="bd-cat-card">
              <DataTable<LaboMaterialDto>
                columns={columns}
                dataSource={materialsQuery.data?.items ?? []}
                rowKey="id"
                loading={materialsQuery.isFetching}
                locale={{
                  emptyText:
                    groups.length === 0
                      ? t("Labo:Material:NeedGroupFirst")
                      : debouncedKeyword
                        ? t("Common:NoResultsMatch")
                        : t("Common:NoData"),
                }}
                pagination={pagination.buildConfig(totalCount, countedTotal(t("Labo:Noun:Material")))}
              />
            </div>
          </div>
        </div>
      </div>

      <LaboMaterialGroupDialog
        open={groupDialog.open}
        group={groupDialog.group}
        onClose={() => setGroupDialog({ open: false, group: null })}
      />

      <LaboMaterialDialog
        open={materialDialog.open}
        material={materialDialog.material}
        groups={groups}
        defaultTaxonomyId={selectedGroupId ?? undefined}
        onClose={() => setMaterialDialog({ open: false, material: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={pendingDelete?.kind === "group" ? t("Labo:Noun:Group") : t("Labo:Noun:Material")}
        name={pendingDelete?.name ?? ""}
        pending={groupCommands.remove.isPending || materialCommands.remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
