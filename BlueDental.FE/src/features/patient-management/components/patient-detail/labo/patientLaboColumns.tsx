import type { TableColumnsType } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import { LaboSendDueCell } from "@/features/labo/components/order-dialogs/LaboSendDueCell";
import { LaboTeethChartButton } from "@/features/labo/components/order-dialogs/LaboTeethChartButton";
import {
  LaboImagesButton,
  LaboRowActions,
  type LaboRowActionHandlers,
} from "@/features/labo/components/order-dialogs/laboOrderCells";
import { laboWorkOf } from "@/features/labo/components/order-dialogs/laboRequestSlipText";

const dash = (value: string | undefined) => value ?? "—";

/** Status pill: the stored status, or Hết hạn bảo hành once every card has run out. */
function StatusCell({ order }: { order: LaboOrderDto }) {
  const pill = laboStatusPill(order);
  return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
}

/**
 * The patient's Labo table as the BA drew it (P2910_03), less Phiếu ĐT (P1011:
 * a Labo order no longer belongs to a treatment slip): Gửi → Hẹn giao carries
 * the due tag, Trạng thái the status pill, and Thao tác the one step the status waits on beside Xem. Since F-91
 * the first column is the Mã số (the order code on old orders), Loại phục hình
 * replaces Vật liệu and the supplier is gone, as on Mẫu Labo.
 */
export function buildPatientLaboColumns(actions: LaboRowActionHandlers): TableColumnsType<LaboOrderDto> {
  return [
    {
      title: t("Labo:Slip:SlipNo"),
      key: "orderCode",
      width: 140,
      render: (_, row) => <span className="pd-labo-code">{laboOrderNo(row)}</span>,
    },
    {
      title: t("Labo:Column:SentDue"),
      key: "sentDue",
      width: 140,
      render: (_, row) => <LaboSendDueCell order={row} />,
    },
    { title: t("Patient:QuoteSheet:PrescribingDoctor"), dataIndex: "dentistName", width: 150, render: dash },
    {
      title: t("Common:Status"),
      key: "status",
      width: 150,
      render: (_, row) => <StatusCell order={row} />,
    },
    {
      title: t("Patient:Labo:ProsthesisType"),
      key: "work",
      width: 200,
      render: (_, row) => dash(laboWorkOf(row) || undefined),
    },
    {
      title: t("Patient:DentalChart:ToothNumber"),
      key: "teeth",
      width: 84,
      align: "center",
      render: (_, row) => <LaboTeethChartButton order={row} />,
    },
    { title: t("Patient:Payment:Quantity"), dataIndex: "quantity", width: 76, align: "center" },
    {
      title: t("Patient:Labo:ReturnFile"),
      dataIndex: "images",
      width: 160,
      align: "center",
      render: (value: LaboOrderDto["images"]) => (
        <LaboImagesButton images={value} label={t("Patient:Labo:ViewFile")} />
      ),
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 112,
      align: "center",
      fixed: "right",
      render: (_, row) => <LaboRowActions row={row} {...actions} />,
    },
  ];
}
