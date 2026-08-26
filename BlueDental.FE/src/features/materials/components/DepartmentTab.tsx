import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Tooltip } from "antd";
import { GroupOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { useAllocationList, type MaterialAllocationDto } from "../api/allocationApi";
import {
  useDeleteDepartment,
  useDepartmentList,
  type DepartmentDto,
} from "../api/departmentApi";
import { DepartmentDialog } from "./DepartmentDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { GroupPanel } from "@/components/GroupPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";

/**
 * Phòng ban — the departments on the left, what has been issued to the selected
 * one on the right.
 *
 * The panel is the same one the material groups use; the reference draws them
 * alike, down to the subtitle telling you to pick one.
 */
export function DepartmentTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("department");

  const [panelKeyword, setPanelKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; department: DepartmentDto | null }>({
    open: false,
    department: null,
  });
  const [pendingDelete, setPendingDelete] = useState<DepartmentDto | null>(null);

  const pagination = useTablePagination(20);
  const debouncedPanel = useDebounce(panelKeyword, 300);
  const debounced = useDebounce(keyword, 300);

  const departmentsQuery = useDepartmentList();
  const deleteDepartment = useDeleteDepartment();

  // The endpoint takes no search, so the typed term narrows what came back.
  const departments = useMemo(() => {
    const all = departmentsQuery.data?.items ?? [];
    const term = debouncedPanel.trim().toLowerCase();
    return term
      ? all.filter((row: DepartmentDto) => row.name.toLowerCase().includes(term))
      : all;
  }, [departmentsQuery.data, debouncedPanel]);

  const allocationsQuery = useAllocationList(selectedId ?? undefined);

  const rows = useMemo(() => {
    if (!selectedId) return [];

    const all = allocationsQuery.data?.items ?? [];
    const term = debounced.trim().toLowerCase();
    return term
      ? all.filter((row: MaterialAllocationDto) =>
          (row.inventoryItemName ?? "").toLowerCase().includes(term),
        )
      : all;
  }, [allocationsQuery.data, debounced, selectedId]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteDepartment.mutateAsync(pendingDelete.id);
      // The table beside it is that department's own list, so stop showing it.
      if (selectedId === pendingDelete.id) selectDepartment(null);
      toast.success(t("Đã xoá phòng ban"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const selectDepartment = (id: string | null) => {
    setSearchParams((params) => {
      if (id) params.set("department", id);
      else params.delete("department");
      return params;
    });
    pagination.resetToFirstPage();
  };

  const columns = useMemo<ColumnsType<MaterialAllocationDto>>(
    () => [
      {
        key: "allocationTime",
        title: t("Thời gian phân bổ"),
        width: 190,
        render: (_, row) => <span className="bd-cat-num">{formatDateTime(row.allocationTime)}</span>,
      },
      { key: "code", title: t("Mã phân bổ"), width: 160, dataIndex: "allocationCode" },
      {
        key: "item",
        title: t("Vật tư"),
        width: 200,
        render: (_, row) => row.inventoryItemName ?? "—",
      },
      {
        key: "issued",
        title: t("SL được phát"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.allocatedQuantity}</span>,
      },
      {
        key: "remaining",
        title: t("SL còn lại (đã duyệt)"),
        width: 190,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.confirmedRemaining}</span>,
      },
      {
        key: "stocktake",
        title: t("Kiểm kho"),
        width: 140,
        // The reference shows a stock-take column here; BlueDental keeps no
        // stock-take against an allocation yet, so it reads as empty rather
        // than inventing a number.
        render: () => "—",
      },
      {
        key: "performer",
        title: t("Người thực hiện"),
        width: 180,
        render: (_, row) => row.performerName ?? "—",
      },
      { key: "note", title: t("Ghi chú"), render: (_, row) => row.note ?? "—" },
    ],
    [],
  );

  return (
    <div className="bd-taxonomy-shell">
      <aside className="bd-taxonomy-aside">
        <GroupPanel
          title={t("Phòng ban")}
          subtitle={t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}
          searchPlaceholder={t("Tìm phòng ban...")}
          countNoun={t("phòng ban")}
          emptyText={t("Chưa có phòng ban")}
          createLabel={t("Thêm phòng ban")}
          groups={departments}
          isLoading={departmentsQuery.isLoading}
          isSearching={departmentsQuery.isFetching}
          keyword={panelKeyword}
          onKeywordChange={setPanelKeyword}
          selectedId={selectedId}
          onSelect={(id) => selectDepartment(id === selectedId ? null : id)}
          onCreate={() => setDialog({ open: true, department: null })}
          onRename={(group) => {
            const department =
              departments.find((row: DepartmentDto) => row.id === group.id) ?? null;
            setDialog({ open: true, department });
          }}
          onDelete={(department) => setPendingDelete(department)}
          // Departments carry no order of their own, so the panel offers none.
          onReorder={() => undefined}
        />
      </aside>

      <main className="bd-taxonomy-main">
        <div className="bd-materials-toolbar">
          <Input
            className="bd-materials-search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm vật tư...")}
            aria-label={t("Tìm vật tư")}
            value={keyword}
            allowClear
            onChange={(event) => {
              setKeyword(event.target.value);
              pagination.resetToFirstPage();
            }}
          />

          {/* "Gộp số lượng vật tư", which the reference draws as an icon button
              at the far right of this toolbar. What it does could not be
              observed — the reference branch has no departments and no issued
              materials — so it is offered and disabled rather than guessed at.
              See docs/clone/pages/materials.md. */}
          <Tooltip title={t("Gộp số lượng vật tư")}>
            <Button
              className="bd-materials-sync"
              icon={<GroupOutlined />}
              aria-label={t("Gộp số lượng vật tư")}
              disabled
            />
          </Tooltip>
        </div>

        <div className="bd-cat-body">
          <div className="bd-cat-card">
            <DataTable<MaterialAllocationDto>
              columns={columns}
              dataSource={rows}
              rowKey="id"
              loading={allocationsQuery.isFetching}
              scroll={{ x: 1400 }}
              pagination={pagination.buildConfig(rows.length, (total, shown) =>
                total === 0
                  ? t("Hiển thị 0 trên 0")
                  : t("Hiển thị {0}–{1} trên {2}", shown[0], shown[1], total),
              )}
              locale={{
                emptyText: selectedId
                  ? t("Không có dữ liệu")
                  : t("Chọn phòng ban để xem vật tư đã phân bổ"),
              }}
            />
          </div>
        </div>
      </main>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("phòng ban")}
        name={pendingDelete?.name ?? ""}
        pending={deleteDepartment.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />

      <DepartmentDialog
        open={dialog.open}
        department={dialog.department}
        onClose={() => setDialog({ open: false, department: null })}
        onCreated={(department) => selectDepartment(department.id)}
      />
    </div>
  );
}
