import { useMemo, useState } from "react";
import type React from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Tooltip } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { useDeleteSupply, useSupplies, type SupplyDto } from "../api/suppliesApi";
import { SUPPLIES_GROUP } from "../materialsTabs";
import { MaterialDialog } from "./MaterialDialog";
import { MaterialGroupDialog } from "./MaterialGroupDialog";
import { MaterialStatusTag } from "./MaterialStatusTag";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { GroupPanel } from "@/components/GroupPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import {
  useTaxonomyGroupCommands,
  useTaxonomyGroups,
  type TaxonomyGroup,
} from "@/hooks/useTaxonomyGroups";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";

type PendingDelete = { id: string; name: string };

/**
 * Vật tư phòng khám — the material groups on the left, the materials of the
 * selected one on the right.
 *
 * The groups are taxonomy groups under `supplies`, which is where the reference
 * keeps them, so this draws the same panel Danh mục does rather than a second
 * one that merely looks like it.
 */
export function ClinicMaterialsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGroupId = searchParams.get("group");

  const [groupKeyword, setGroupKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; group: TaxonomyGroup | null }>({
    open: false,
    group: null,
  });
  const [materialDialog, setMaterialDialog] = useState<{
    open: boolean;
    material: SupplyDto | null;
  }>({ open: false, material: null });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const pagination = useTablePagination(20);
  const debouncedGroups = useDebounce(groupKeyword, 300);
  const debounced = useDebounce(keyword, 300);

  const groupsQuery = useTaxonomyGroups(SUPPLIES_GROUP, debouncedGroups.trim() || undefined);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const { remove: removeGroup, reorder } = useTaxonomyGroupCommands(SUPPLIES_GROUP);

  const suppliesQuery = useSupplies({
    taxonomyId: selectedGroupId ?? undefined,
    filter: debounced.trim() || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const materials = suppliesQuery.data?.items ?? [];
  const deleteSupply = useDeleteSupply();

  const selectGroup = (id: string | null) => {
    setSearchParams((params) => {
      if (id) params.set("group", id);
      else params.delete("group");
      return params;
    });
    pagination.resetToFirstPage();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteSupply.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá vật tư"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<SupplyDto>>(
    () => [
      {
        key: "name",
        title: t("Tên vật liệu"),
        width: 220,
        render: (_, row) => <span className="bd-cat-medium">{row.name}</span>,
      },
      {
        key: "group",
        title: t("Nhóm phân loại"),
        width: 180,
        render: (_, row) => row.taxonomyName ?? "—",
      },
      {
        key: "stockedAt",
        title: t("Nhập kho"),
        width: 140,
        render: (_, row) => (
          <span className="bd-cat-num">{row.stockedAt ? formatDate(row.stockedAt) : "—"}</span>
        ),
      },
      {
        key: "expiryDate",
        title: t("Hạn sử dụng"),
        width: 140,
        render: (_, row) => (
          <span className="bd-cat-num">{row.expiryDate ? formatDate(row.expiryDate) : "—"}</span>
        ),
      },
      {
        key: "expiryWarningDays",
        title: t("Cảnh báo hết hạn"),
        width: 170,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">{t("{0} ngày", row.expiryWarningDays)}</span>
        ),
      },
      {
        key: "quantityOnHand",
        title: t("Tồn kho"),
        width: 120,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.quantityOnHand}</span>,
      },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 170,
        render: (_, row) => <MaterialStatusTag status={row.status} />,
      },
      {
        key: "supplier",
        title: t("Nhà cung cấp"),
        width: 180,
        render: (_, row) => row.supplier ?? "—",
      },
      { key: "origin", title: t("Xuất xứ"), width: 150, render: (_, row) => row.origin ?? "—" },
      {
        key: "unitCost",
        title: t("Giá nhập"),
        width: 150,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">{row.unitCost === null ? "—" : formatVND(row.unitCost)}</span>
        ),
      },
      {
        key: "salePrice",
        title: t("Giá bán"),
        width: 150,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num">
            {row.salePrice === null ? "—" : formatVND(row.salePrice)}
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
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
                onClick={() => setPendingDelete({ id: row.id, name: row.name })}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-taxonomy-shell">
      <aside className="bd-taxonomy-aside">
        <GroupPanel
          title={t("Nhóm vật tư")}
          subtitle={t("Chọn nhóm để xem vật tư")}
          searchPlaceholder={t("Tìm nhóm vật tư...")}
          groups={groups}
          isLoading={groupsQuery.isLoading}
          isSearching={groupsQuery.isFetching}
          keyword={groupKeyword}
          onKeywordChange={setGroupKeyword}
          selectedId={selectedGroupId}
          onSelect={(id) => selectGroup(id === selectedGroupId ? null : id)}
          onCreate={() => setGroupDialog({ open: true, group: null })}
          onRename={(group) => setGroupDialog({ open: true, group })}
          onDelete={(group) => void removeGroup.mutateAsync(group.id)}
          onReorder={(from, to) => {
            const ids = groups.map((group) => group.id);
            const [moved] = ids.splice(from, 1);
            ids.splice(to, 0, moved);
            return reorder.mutateAsync(ids);
          }}
        />
      </aside>

      <main className="bd-taxonomy-main">
        <div className="bd-materials-toolbar">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            // Offered whether or not a group is selected, as the reference does:
            // the dialog's required "Nhóm phân loại" is where one is chosen, and
            // the panel's selection only pre-fills it.
            onClick={() => setMaterialDialog({ open: true, material: null })}
          >
            {t("Thêm vật tư")}
          </Button>

          <Input
            className="bd-materials-search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm")}
            aria-label={t("Tìm kiếm")}
            value={keyword}
            allowClear
            onChange={(event) => {
              setKeyword(event.target.value);
              pagination.resetToFirstPage();
            }}
          />

          <Button
            className="bd-materials-sync"
            icon={<SyncOutlined />}
            // The reference offers this and leaves it disabled; BlueDental has
            // no system to sync from, so it says so rather than pretending.
            disabled
            title={t("Chưa kết nối hệ thống nguồn")}
          >
            {t("Sync data hệ thống")}
          </Button>
        </div>

        <div className="bd-cat-body">
          <div className="bd-cat-card">
            <DataTable<SupplyDto>
              columns={columns}
              dataSource={materials}
              rowKey="id"
              loading={suppliesQuery.isFetching}
              // The reference leads with a checkbox column. What it offers once
              // rows are ticked could not be observed — the reference branch
              // holds no materials — so this selects and nothing more.
              // See docs/clone/pages/materials.md.
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              scroll={{ x: 1900 }}
              pagination={pagination.buildConfig(
                suppliesQuery.data?.totalCount ?? 0,
                (total, shown) =>
                  total === 0
                    ? t("Hiển thị 0 trên 0")
                    : t("Hiển thị {0}–{1} trên {2}", shown[0], shown[1], total),
              )}
              locale={{ emptyText: t("Không có dữ liệu") }}
            />
          </div>
        </div>
      </main>

      <MaterialGroupDialog
        open={groupDialog.open}
        group={groupDialog.group}
        onClose={() => setGroupDialog({ open: false, group: null })}
        onCreated={(group) => selectGroup(group.id)}
      />

      <MaterialDialog
        open={materialDialog.open}
        material={materialDialog.material}
        groups={groups}
        defaultTaxonomyId={selectedGroupId}
        onClose={() => setMaterialDialog({ open: false, material: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("vật tư")}
        name={pendingDelete?.name ?? ""}
        pending={deleteSupply.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
