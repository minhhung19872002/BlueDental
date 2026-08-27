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
  useReorderDepartments,
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

/** A row after "Gộp số lượng vật tư" has folded several vouchers into one. */
type MergedAllocation = MaterialAllocationDto & { mergedCount?: number };

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
  const [merged, setMerged] = useState(false);

  const pagination = useTablePagination(20);
  const debouncedPanel = useDebounce(panelKeyword, 300);
  const debounced = useDebounce(keyword, 300);

  const departmentsQuery = useDepartmentList();
  const deleteDepartment = useDeleteDepartment();
  const reorderDepartments = useReorderDepartments();

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
    const terms = debounced.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matching = terms.length
      ? all.filter((row: MaterialAllocationDto) => {
          const haystack = (row.inventoryItemName ?? "").toLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
      : all;

    if (!merged) return matching;

    // One row per material, its quantities added up. Vouchers issued at
    // different times collapse into the earliest, and the code column says how
    // many were folded together rather than showing one of them as if it were
    // the whole story.
    const byMaterial = new Map<string, MaterialAllocationDto & { mergedCount: number }>();

    for (const row of matching) {
      const key = row.inventoryItemId;
      const seen = byMaterial.get(key);

      if (!seen) {
        byMaterial.set(key, { ...row, mergedCount: 1 });
        continue;
      }

      seen.allocatedQuantity += row.allocatedQuantity;
      seen.confirmedRemaining += row.confirmedRemaining;
      seen.mergedCount += 1;
      if (row.allocationTime < seen.allocationTime) seen.allocationTime = row.allocationTime;
    }

    return [...byMaterial.values()];
  }, [allocationsQuery.data, debounced, selectedId, merged]);

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
      {
        key: "code",
        title: t("Mã phân bổ"),
        width: 160,
        render: (_, row) => {
          const folded = (row as MergedAllocation).mergedCount ?? 1;
          return folded > 1 ? t("{0} phiếu", folded) : row.allocationCode;
        },
      },
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
          createLabel={t("Tạo phòng ban")}
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
          onReorder={(from, to) => {
            const ids = departments.map((row: DepartmentDto) => row.id);
            const [moved] = ids.splice(from, 1);
            ids.splice(to, 0, moved);
            return reorderDepartments.mutateAsync(ids);
          }}
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
              at the far right of this toolbar. Its exact behaviour could not be
              observed — the reference branch has no departments and no issued
              materials — so this does the plain reading of the label: it folds
              the rows to one per material with the quantities added up, and
              changes nothing that is stored. Recorded as an assumption in
              docs/clone/pages/materials.md. */}
          <Tooltip
            title={
              !selectedId
                ? t("Chọn phòng ban trước khi gộp")
                : merged
                  ? t("Bỏ gộp số lượng vật tư")
                  : t("Gộp số lượng vật tư")
            }
          >
            <span className="bd-materials-sync">
              <Button
                icon={<GroupOutlined />}
                aria-label={t("Gộp số lượng vật tư")}
                aria-pressed={merged}
                type={merged ? "primary" : "default"}
                disabled={!selectedId}
                onClick={() => {
                  setMerged((on) => !on);
                  pagination.resetToFirstPage();
                }}
              />
            </span>
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
