import { useMemo, useState } from "react";
import { Empty, Table } from "antd";
import { t } from "@/lib/i18n";
import type { VoucherDto } from "../api/voucherApi";
import { buildVoucherColumns } from "./VoucherColumns";
import { VoucherServicesModal } from "./VoucherServicesModal";

interface Props {
  data: VoucherDto[];
  loading: boolean;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEdit: (row: VoucherDto) => void;
  onDelete: (id: string) => void;
}

export function VoucherTable({
  data,
  loading,
  onPublish,
  onUnpublish,
  onEdit,
  onDelete,
}: Props) {
  // "Xem chi tiết" in the conditions column — a table concern, so the page
  // doesn't need to know about it.
  const [viewingServices, setViewingServices] = useState<VoucherDto | null>(null);

  const columns = useMemo(
    () =>
      buildVoucherColumns({
        onPublish,
        onUnpublish,
        onEdit,
        onDelete,
        onShowServices: setViewingServices,
      }),
    [onPublish, onUnpublish, onEdit, onDelete],
  );

  return (
    <>
      <Table<VoucherDto>
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        size="middle"
        /* The columns add up to 1320px. Without it a phone squeezes them all
           into 360 and every cell wraps to four lines. */
        scroll={{ x: 1320 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t(
                'Chưa có voucher nào — nhấn "Tạo voucher" để bắt đầu.',
              )}
            />
          ),
        }}
        pagination={{
          pageSize: 20,
          showTotal: (total, range) =>
            t("Hiển thị {0}–{1} trên {2}", range[0], range[1], total),
        }}
      />
      <VoucherServicesModal
        voucher={viewingServices}
        onClose={() => setViewingServices(null)}
      />
    </>
  );
}
