import { useMemo, useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { DeleteOutlined, FileSearchOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import {
  useAllocationList,
  useDeleteAllocation,
  type MaterialAllocationDto,
} from "../api/allocationApi";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";

/**
 * Phân bổ vật tư — the vouchers moving material out to a department.
 *
 * No group panel here: the reference gives this section the full width, a
 * search, and one command for the stock-take history.
 */
export function AllocationTab() {
  const [keyword, setKeyword] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MaterialAllocationDto | null>(null);

  const pagination = useTablePagination(20);
  const debounced = useDebounce(keyword, 300);

  // Searched on the server: it used to sweep whatever the first page held, so
  // a voucher past it could not be found at all.
  const query = useAllocationList(undefined, debounced);
  const deleteAllocation = useDeleteAllocation();

  const rows = query.data?.items ?? [];

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteAllocation.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá phiếu phân bổ"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
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
        width: 180,
        render: (_, row) => <span className="bd-mat-code">{row.allocationCode}</span>,
      },
      {
        key: "item",
        title: t("Vật tư"),
        width: 220,
        // A voucher carries several materials, so the reference lists their
        // names on one line and hangs the whole list off the title.
        render: (_, row) => {
          const names = row.items.map((item) => item.name).join(", ");
          return (
            <span className="bd-cat-medium bd-alloc-clamp" title={names}>
              {names || "—"}
            </span>
          );
        },
      },
      {
        key: "allocated",
        title: t("SL được phân bổ"),
        width: 170,
        align: "right",
        // Numbers only. The reference repeats each material's name here, but
        // the column beside it already lists them in this same order, so the
        // names read across rather than being said twice. The full "name: qty"
        // stays on the title for anything ambiguous.
        render: (_, row) => {
          const quantities = row.items.map((item) => item.quantity).join(", ");
          const detail = row.items.map((item) => `${item.name}: ${item.quantity}`).join(", ");
          return (
            <span className="bd-cat-num bd-mat-issued bd-alloc-clamp" title={detail}>
              {quantities || "—"}
            </span>
          );
        },
      },
      {
        key: "remaining",
        title: t("SL confirm còn lại"),
        width: 190,
        align: "right",
        // Only the lines a stock-take has come back for, as "left/out" — the
        // ratio is the point, so it stays; the name does not.
        render: (_, row) => {
          const confirmed = row.items.filter((item) => item.confirmedQuantity !== null);
          if (confirmed.length === 0) return "—";

          const ratios = confirmed
            .map((item) => `${item.confirmedQuantity}/${item.quantity}`)
            .join(", ");
          const detail = confirmed
            .map((item) => `${item.name}: ${item.confirmedQuantity}/${item.quantity}`)
            .join(", ");
          return (
            <span className="bd-cat-num bd-mat-remaining bd-alloc-clamp" title={detail}>
              {ratios}
            </span>
          );
        },
      },
      {
        key: "department",
        title: t("Phòng ban"),
        width: 180,
        render: (_, row) => row.departmentName ?? "—",
      },
      {
        key: "performer",
        title: t("Người thực hiện"),
        width: 180,
        render: (_, row) => row.performerName ?? "—",
      },
      { key: "note", title: t("Ghi chú"), render: (_, row) => row.note ?? "—" },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 100,
        align: "center",
        fixed: "right",
        render: (_, row) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", row.allocationCode)}
                onClick={() => setPendingDelete(row)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-materials-plain">
      <div className="bd-materials-toolbar">
        <Input
          className="bd-materials-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm phiếu phân bổ...")}
          aria-label={t("Tìm phiếu phân bổ")}
          value={keyword}
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            pagination.resetToFirstPage();
          }}
        />

        {/* Offered by the reference, which has no data behind it either.
            BlueDental keeps no record of a stock-take — confirming usage moves
            a number and writes no history — so there is nothing for this to
            show. A disabled button swallows its own tooltip, so the reason
            hangs off a wrapper the pointer can still reach. */}
        <Tooltip title={t("Chưa có dữ liệu kiểm kho để xem lịch sử")}>
          <span className="bd-materials-sync">
            <Button icon={<FileSearchOutlined />} disabled>
              {t("Lịch sử kiểm kho")}
            </Button>
          </span>
        </Tooltip>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<MaterialAllocationDto>
            columns={columns}
            dataSource={rows}
            rowKey="id"
            loading={query.isFetching}
            scroll={{ x: 1550 }}
            pagination={pagination.buildConfig(rows.length, (total, shown) =>
              total === 0
                ? t("Hiển thị 0 trên 0")
                : t("Hiển thị {0}–{1} trên {2}", shown[0], shown[1], total),
            )}
            locale={{ emptyText: t("Chưa có phiếu phân bổ") }}
          />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("phiếu phân bổ")}
        name={pendingDelete?.allocationCode ?? ""}
        pending={deleteAllocation.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
