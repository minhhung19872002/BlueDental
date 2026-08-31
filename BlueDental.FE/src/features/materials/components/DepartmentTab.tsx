import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Tag, Tooltip } from "antd";
import { GroupOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { useAllocationList } from "../api/allocationApi";
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
import { useBranchFilter } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";

/** One material on one voucher, which is the row this table shows. */
interface AllocationLine {
  id: string;
  allocationId: string;
  allocationCode: string;
  allocatedAt: string;
  performerName?: string;
  note?: string;
  supplyId: string;
  name: string;
  quantity: number;
  confirmedQuantity: number | null;
}

/**
 * One material's whole story in this department, which is what the reference
 * swaps the table to when "Gộp số lượng vật tư" is on — a different set of
 * columns, not the detail rows folded together.
 */
interface MaterialSummary {
  supplyId: string;
  name: string;
  totalQuantity: number;
  totalConfirmed: number | null;
  allocationCount: number;
  latestAllocatedAt: string;
}

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

  const branchId = useBranchFilter();
  const pagination = useTablePagination(20);
  const debouncedPanel = useDebounce(panelKeyword, 300);
  const debounced = useDebounce(keyword, 300);

  // Searched on the server, as the reference searches it.
  const departmentsQuery = useDepartmentList(debouncedPanel, branchId);
  const deleteDepartment = useDeleteDepartment();
  const reorderDepartments = useReorderDepartments();

  const departments = useMemo(
    () => departmentsQuery.data?.items ?? [],
    [departmentsQuery.data],
  );

  // The term goes to the server, which narrows to the vouchers that mention it.
  const allocationsQuery = useAllocationList(branchId, selectedId ?? undefined, debounced);

  /**
   * One row per material per voucher — the reference flattens the vouchers out,
   * because what a department wants to see is materials, not paperwork.
   */
  const rows = useMemo<AllocationLine[]>(() => {
    if (!selectedId) return [];

    const flattened: AllocationLine[] = [];
    for (const voucher of allocationsQuery.data?.items ?? []) {
      for (const item of voucher.items) {
        flattened.push({
          id: `${voucher.id}:${item.inventoryItemId}`,
          allocationId: voucher.id,
          allocationCode: voucher.allocationCode,
          allocatedAt: voucher.allocationTime,
          performerName: voucher.performerName,
          note: voucher.note,
          supplyId: item.inventoryItemId,
          name: item.name,
          quantity: item.quantity,
          confirmedQuantity: item.confirmedQuantity,
        });
      }
    }

    // The server has already narrowed this to the vouchers that mention the
    // term. A voucher carries several materials, though, so its other lines
    // come back with it — this keeps the rows to the ones actually searched
    // for, rather than showing whatever else happened to travel alongside.
    const terms = debounced.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return flattened;

    return flattened.filter((line) => {
      const haystack = line.name.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [allocationsQuery.data, debounced, selectedId]);

  /**
   * The same rows gathered per material: total issued, total confirmed, how
   * many times it was issued and when it last was.
   */
  const summaries = useMemo<MaterialSummary[]>(() => {
    const byMaterial = new Map<string, MaterialSummary>();

    for (const line of rows) {
      const seen = byMaterial.get(line.supplyId);

      if (!seen) {
        byMaterial.set(line.supplyId, {
          supplyId: line.supplyId,
          name: line.name,
          totalQuantity: line.quantity,
          totalConfirmed: line.confirmedQuantity,
          allocationCount: 1,
          latestAllocatedAt: line.allocatedAt,
        });
        continue;
      }

      seen.totalQuantity += line.quantity;
      if (line.confirmedQuantity !== null) {
        seen.totalConfirmed = (seen.totalConfirmed ?? 0) + line.confirmedQuantity;
      }
      seen.allocationCount += 1;
      if (line.allocatedAt > seen.latestAllocatedAt) {
        seen.latestAllocatedAt = line.allocatedAt;
      }
    }

    return [...byMaterial.values()];
  }, [rows]);

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

  const columns = useMemo<ColumnsType<AllocationLine>>(
    () => [
      {
        key: "allocatedAt",
        title: t("Thời gian phân bổ"),
        width: 190,
        render: (_, row) => <span className="bd-cat-num">{formatDateTime(row.allocatedAt)}</span>,
      },
      {
        key: "code",
        title: t("Mã phân bổ"),
        width: 180,
        render: (_, row) => <span className="bd-mat-code">{row.allocationCode || "—"}</span>,
      },
      {
        key: "name",
        title: t("Vật tư"),
        width: 220,
        render: (_, row) => <span className="bd-cat-medium">{row.name}</span>,
      },
      {
        key: "issued",
        title: t("SL được phát"),
        width: 150,
        align: "right",
        render: (_, row) => <span className="bd-cat-num bd-mat-issued">{row.quantity}</span>,
      },
      {
        key: "remaining",
        title: t("SL còn lại (đã duyệt)"),
        width: 190,
        align: "right",
        render: (_, row) =>
          row.confirmedQuantity === null ? (
            "—"
          ) : (
            <span className="bd-cat-num bd-mat-remaining">{row.confirmedQuantity}</span>
          ),
      },
      {
        key: "stocktake",
        title: t("Kiểm kho"),
        width: 140,
        // The reference shows a status here. BlueDental keeps no stock-take
        // record of its own, so a line simply reads as not yet checked until a
        // remaining figure comes back for it.
        render: (_, row) =>
          row.confirmedQuantity === null ? (
            <Tag className="bd-alloc-unchecked">{t("Chưa kiểm")}</Tag>
          ) : (
            <Tag color="green">{t("Đã kiểm")}</Tag>
          ),
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

  const summaryColumns = useMemo<ColumnsType<MaterialSummary>>(
    () => [
      {
        key: "name",
        title: t("Vật tư"),
        render: (_, row) => <span className="bd-cat-medium">{row.name}</span>,
      },
      {
        key: "totalQty",
        title: t("Tổng SL phân bổ"),
        width: 180,
        align: "right",
        render: (_, row) => (
          <span className="bd-cat-num bd-mat-issued">{row.totalQuantity}</span>
        ),
      },
      {
        key: "totalConfirmed",
        title: t("Tổng còn lại (đã duyệt)"),
        width: 220,
        align: "right",
        render: (_, row) =>
          row.totalConfirmed === null ? (
            "—"
          ) : (
            <span className="bd-cat-num bd-mat-remaining">{row.totalConfirmed}</span>
          ),
      },
      {
        key: "allocationCount",
        title: t("Số lần phân bổ"),
        width: 170,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{t("{0} lần", row.allocationCount)}</span>,
      },
      {
        key: "latestAllocatedAt",
        title: t("Lần phân bổ gần nhất"),
        width: 210,
        render: (_, row) => (
          <span className="bd-cat-num">
            {row.latestAllocatedAt ? formatDateTime(row.latestAllocatedAt) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  // The two views count differently, so the footer has to follow whichever is
  // on screen.
  const shown = merged ? summaries.length : rows.length;

  const emptyText = selectedId
    ? t("Phòng ban này chưa được phân bổ vật tư")
    : t("Chọn phòng ban để xem vật tư đã phân bổ");

  return (
    <div className="bd-taxonomy-shell">
      <aside className="bd-taxonomy-aside">
        <GroupPanel
          title={t("Phòng ban")}
          subtitle={t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}
          searchPlaceholder={t("Tìm phòng ban...")}
          countNoun={t("phòng ban")}
          emptyText={t("Chưa có phòng ban")}
          notFoundText={t("Không tìm thấy phòng ban phù hợp")}
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
                  ? t("Xem chi tiết phân bổ")
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
            {/* The reference swaps the whole table, not the rows: gathered by
                material it asks different questions of the data, so it shows
                different columns. */}
            {merged ? (
              <DataTable<MaterialSummary>
                columns={summaryColumns}
                dataSource={summaries}
                rowKey="supplyId"
                loading={allocationsQuery.isFetching}
                scroll={{ x: 1100 }}
                pagination={pagination.buildConfig(shown, (total, range) =>
                  total === 0
                    ? t("Hiển thị 0 trên 0")
                    : t("Hiển thị {0}–{1} trên {2}", range[0], range[1], total),
                )}
                locale={{ emptyText: emptyText }}
              />
            ) : (
              <DataTable<AllocationLine>
                columns={columns}
                dataSource={rows}
                rowKey="id"
                loading={allocationsQuery.isFetching}
                scroll={{ x: 1400 }}
                pagination={pagination.buildConfig(shown, (total, range) =>
                  total === 0
                    ? t("Hiển thị 0 trên 0")
                    : t("Hiển thị {0}–{1} trên {2}", range[0], range[1], total),
                )}
                locale={{ emptyText: emptyText }}
              />
            )}
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
