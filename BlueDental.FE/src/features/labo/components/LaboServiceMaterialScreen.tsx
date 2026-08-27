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
export function LaboServiceMaterialScreen() {
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
      toast.success(t("Đã xoá"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const columns: ColumnsType<LaboMaterialDto> = [
    {
      key: "name",
      title: t("Vật liệu"),
      render: (_, row) => (
        <p className="bd-cat-name">{row.name}</p>
      ),
    },
    {
      key: "taxonomyName",
      title: t("Nhóm phân loại"),
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
      title: t("Cập nhật gần nhất"),
      width: 240,
      render: (_, row) => (
        <span className="bd-cat-num">
          {formatDateTime(row.lastModificationTime ?? row.creationTime)}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <div className="bd-cat-rowactions">
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t("Chỉnh sửa {0}", row.name)}
              onClick={() => setMaterialDialog({ open: true, material: row })}
            />
          </Tooltip>
          <Tooltip title={t("Xoá")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("Xoá {0}", row.name)}
              onClick={() => setPendingDelete({ kind: "material", id: row.id, name: row.name })}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const groupPanel = (
    <GroupPanel<LaboCatalogItem & { entryCount?: number }>
      title={t("Nhóm phân loại")}
      subtitle={t("Chọn nhóm để xem vật liệu bên trong")}
      groups={groups.map((group) => ({ ...group, entryCount: group.itemCount }))}
      isLoading={groupsQuery.isLoading}
      isSearching={groupsQuery.isFetching && !groupsQuery.isLoading}
      keyword={groupKeyword}
      onKeywordChange={setGroupKeyword}
      selectedId={selectedGroupId}
      onSelect={selectGroup}
      onCreate={() => setGroupDialog({ open: true, group: null })}
      onRename={(group) => setGroupDialog({ open: true, group })}
      onDelete={(group) => setPendingDelete({ kind: "group", id: group.id, name: group.name })}
      // The reference orders these groups by the priority its own dialog
      // collects, and offers no drag — so there is nothing to persist here.
      onReorder={() => undefined}
      searchPlaceholder={t("Tìm nhóm phân loại...")}
      createLabel={t("Thêm nhóm phân loại")}
      emptyText={t("Chưa có nhóm phân loại")}
      notFoundText={t("Không tìm thấy nhóm phù hợp")}
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
          title={t("Nhóm phân loại")}
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
                {t("Chọn nhóm")}
              </Button>

              <Input
                className="bd-labo-search"
                prefix={<SearchOutlined />}
                placeholder={t("Tìm kiếm")}
                aria-label={t("Tìm kiếm vật liệu")}
                value={keyword}
                maxLength={100}
                allowClear
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={groups.length === 0}
              onClick={() => setMaterialDialog({ open: true, material: null })}
            >
              {t("Tạo vật liệu")}
            </Button>
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
                      ? t("Cần tạo ít nhất một nhóm phân loại trước khi thêm vật liệu.")
                      : debouncedKeyword
                        ? t("Không tìm thấy kết quả phù hợp")
                        : t("Không có dữ liệu"),
                }}
                pagination={pagination.buildConfig(totalCount, countedTotal(t("vật liệu")))}
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
        noun={pendingDelete?.kind === "group" ? t("nhóm") : t("vật liệu")}
        name={pendingDelete?.name ?? ""}
        pending={groupCommands.remove.isPending || materialCommands.remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
