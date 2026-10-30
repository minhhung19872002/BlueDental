import type { TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import { LaboSendDueCell } from "@/features/labo/components/order-dialogs/LaboSendDueCell";
import { LaboTeethChartButton } from "@/features/labo/components/order-dialogs/LaboTeethChartButton";
import {
  LaboImagesButton,
  LaboRowActions,
  LaboSupplierBadge,
  type LaboRowActionHandlers,
} from "@/features/labo/components/order-dialogs/laboOrderCells";

const dash = (value: string | undefined) => value ?? "—";

interface ColumnContext {
  patientId: string;
  branchId: string;
}

/** Status pill: the stored status, or Hết hạn bảo hành once every card has run out. */
function StatusCell({ order }: { order: LaboOrderDto }) {
  const pill = laboStatusPill(order);
  return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
}

/**
 * The patient's Labo table as the BA drew it (P2910_03): Phiếu ĐT opens the
 * treatment slip, Gửi → Hẹn giao carries the due tag, Trạng thái the status
 * pill, and Thao tác the one step the status waits on beside Xem.
 */
export function buildPatientLaboColumns(
  actions: LaboRowActionHandlers,
  { patientId, branchId }: ColumnContext,
): TableColumnsType<LaboOrderDto> {
  return [
    {
      title: t("Patient:Labo:Code"),
      dataIndex: "orderCode",
      width: 140,
      render: (value: string) => <span className="pd-labo-code">{value}</span>,
    },
    {
      title: t("Labo:Column:Plan"),
      dataIndex: "treatmentPlanCode",
      width: 96,
      render: (value: string | undefined, row) =>
        value && row.treatmentPlanId ? (
          <Link
            className="pd-labo-plan-link"
            to={withBranch(`/patient/${patientId}/treatment-plan/${row.treatmentPlanId}`, branchId)}
          >
            {value}
          </Link>
        ) : (
          "—"
        ),
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
      title: t("Patient:Labo:Supplier"),
      dataIndex: "labProviderName",
      width: 170,
      render: (value: string | undefined, row) => (
        <LaboSupplierBadge name={value} color={row.supplierLabelColor} />
      ),
    },
    { title: t("Patient:Labo:Material"), dataIndex: "materialName", width: 170, render: dash },
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
