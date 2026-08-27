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

  const query = useAllocationList();
  const deleteAllocation = useDeleteAllocation();

  // The endpoint takes no search, so a typed term narrows what came back. The
  // list is one branch's vouchers, not a table that needs paging on the server.
  const rows = useMemo(() => {
    const all = query.data?.items ?? [];
    const term = debounced.trim().toLowerCase();
    if (!term) return all;

    return all.filter((row: MaterialAllocationDto) =>
      [row.allocationCode, row.inventoryItemName, row.departmentName, row.performerName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [query.data, debounced]);

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
      { key: "code", title: t("Mã phân bổ"), width: 160, dataIndex: "allocationCode" },
      {
        key: "item",
        title: t("Vật tư"),
        width: 200,
        render: (_, row) => row.inventoryItemName ?? "—",
      },
      {
        key: "allocated",
        title: t("SL được phân bổ"),
        width: 170,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.allocatedQuantity}</span>,
      },
      {
        key: "remaining",
        title: t("SL confirm còn lại"),
        width: 180,
        align: "right",
        render: (_, row) => <span className="bd-cat-num">{row.confirmedRemaining}</span>,
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
            scroll={{ x: 1500 }}
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
