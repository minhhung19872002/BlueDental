import { useMemo, useState } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, type PaginationProps } from "antd";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import {
  useCareRecordList,
  useCareStats,
  useDeleteCareRecord,
  type CareRecordDto,
} from "@/features/cskh/api/careApi";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { t, tRich } from "@/lib/i18n";
import type { PatientDto } from "../../../types/patient";
import { CareDetailDialog } from "./CareDetailDialog";
import { CareStatChips } from "./CareStatChips";
import { PatientCareDialog } from "./PatientCareDialog";
import { buildCareColumns } from "./careColumns";
import { careChipParams, type CareChipKey } from "./careChips";

/** The reference offers a five-row page the shared hook does not. */
const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: CareRecordDto }
  | { kind: "detail"; record: CareRecordDto }
  | { kind: "delete"; record: CareRecordDto };

const CLOSED: DialogState = { kind: "closed" };

/** The reference names its pager halves — "‹ Trước" and "Sau ›" — rather than bare arrows. */
const renderPagerItem: PaginationProps["itemRender"] = (_page, type, element) => {
  if (type === "prev") return <Button size="small" icon={<LeftOutlined />}>{t("Trước")}</Button>;
  if (type === "next") return <Button size="small">{t("Sau")}<RightOutlined /></Button>;
  return element;
};

/** "Hiển thị 1 trên 1 nhật ký" — the first number is how many rows this page shows. */
function showPageTotal(total: number, range: [number, number]) {
  const shown = total === 0 ? 0 : range[1] - range[0] + 1;
  return tRich("Hiển thị {0} trên {1} nhật ký", <b>{shown}</b>, <b>{total}</b>);
}

export function PatientCareTab({ patient }: { patient: PatientDto }) {
  const [chip, setChip] = useState<CareChipKey | null>(null);
  const [dialog, setDialog] = useState<DialogState>(CLOSED);
  const pagination = useTablePagination(20);
  const list = useCareRecordList({
    patientId: patient.id,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    ...careChipParams(chip),
  });
  const stats = useCareStats({ patientId: patient.id });
  const remove = useDeleteCareRecord();

  const handleToggle = (key: CareChipKey) => {
    setChip((current) => (current === key ? null : key));
    pagination.resetToFirstPage();
  };
  const close = () => setDialog(CLOSED);
  const handleDelete = async () => {
    if (dialog.kind !== "delete") return;
    try {
      await remove.mutateAsync(dialog.record.id);
      toast.success(t("Đã xoá lượt chăm sóc"));
      close();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const columns = useMemo(
    () =>
      buildCareColumns({
        onDetail: (record) => setDialog({ kind: "detail", record }),
        onEdit: (record) => setDialog({ kind: "edit", record }),
        onDelete: (record) => setDialog({ kind: "delete", record }),
      }),
    [],
  );

  return (
    <section className="pd-pane pd-pane--fill pc-tab">
      <div className="pc-toolbar">
        <CareStatChips stats={stats.data} active={chip} onToggle={handleToggle} />
        <Button
          type="primary"
          className="pc-add"
          icon={<Plus size={16} />}
          onClick={() => setDialog({ kind: "create" })}
        >
          {t("CSKH đặc biệt")}
        </Button>
      </div>
      <div className="bd-cat-card pc-card">
        <DataTable<CareRecordDto>
          rowKey="id"
          bordered
          loading={list.isLoading}
          columns={columns}
          dataSource={list.data?.items ?? []}
          locale={{ emptyText: t("Không có dữ liệu") }}
          pagination={{
            ...pagination.buildConfig(list.data?.totalCount, showPageTotal),
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            itemRender: renderPagerItem,
          }}
        />
      </div>
      <PatientCareDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        patient={patient}
        record={dialog.kind === "edit" ? dialog.record : null}
        onClose={close}
      />
      <CareDetailDialog record={dialog.kind === "detail" ? dialog.record : null} onClose={close} />
      <ConfirmDeleteDialog
        open={dialog.kind === "delete"}
        noun={t("lượt chăm sóc")}
        title={t("Xóa lượt chăm sóc")}
        question={t("Bạn có chắc chắn muốn xóa lượt chăm sóc này không?")}
        pending={remove.isPending}
        onConfirm={() => void handleDelete()}
        onClose={close}
      />
    </section>
  );
}
