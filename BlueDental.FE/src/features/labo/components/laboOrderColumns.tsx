import { Link } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { StatusBadge } from "@/components/StatusBadge";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboOrderDto } from "../api/laboApi";
import { laboStatusPill } from "../api/laboStatus";
import { LaboSendDueCell } from "./order-dialogs/LaboSendDueCell";
import {
  LaboImagesButton,
  LaboRowActions,
  LaboSupplierBadge,
  type LaboRowActionHandlers,
} from "./order-dialogs/laboOrderCells";

interface Options extends Pick<LaboRowActionHandlers, "onDetail"> {
  /** Rides on the patient and treatment-slip links, as on the reference. */
  branchId: string;
}

const dash = (value: string | undefined) => value ?? <span className="bd-cat-num">—</span>;

/**
 * Mẫu Labo — the reference's columns (docs/clone/pages/labo.md §2.4) with
 * P2910_03's Gửi → Hẹn giao and Trạng thái in place of the two date/pill
 * pairs: the code, the supplier over its creation date, the customer and the
 * treatment slip as links into the patient record, the dentist, material and
 * teeth, the returned-file folder and Thao tác (Xem only — the workflow runs
 * on the patient record).
 */
export function buildLaboOrderColumns({ branchId, onDetail }: Options): ColumnsType<LaboOrderDto> {
  const patientHref = (row: LaboOrderDto) => withBranch(`/patient/${row.patientId}`, branchId);
  const planHref = (row: LaboOrderDto) =>
    withBranch(`/patient/${row.patientId}/treatment-plan/${row.treatmentPlanId}`, branchId);

  return [
    {
      key: "orderCode",
      title: t("Patient:Labo:Code"),
      width: 132,
      render: (_, row) => <span className="pd-labo-code">{row.orderCode}</span>,
    },
    {
      key: "supplier",
      title: t("Labo:Orders:SupplierCreatedAt"),
      width: 180,
      render: (_, row) => (
        <div className="bd-labo-stack">
          <LaboSupplierBadge name={row.supplierName ?? row.labProviderName} color={row.supplierLabelColor} />
          <span className="bd-labo-sub">{formatDate(row.creationTime)}</span>
        </div>
      ),
    },
    {
      key: "patient",
      title: t("Labo:Orders:CustomerName"),
      width: 220,
      render: (_, row) =>
        row.patientName ? (
          <Link className="bd-labo-link" to={patientHref(row)}>
            {row.patientCode ? `[${row.patientCode}] - ${row.patientName}` : row.patientName}
          </Link>
        ) : (
          dash(undefined)
        ),
    },
    {
      key: "treatmentPlan",
      title: t("Labo:Orders:TreatmentSlip"),
      width: 104,
      render: (_, row) =>
        row.treatmentPlanId && row.treatmentPlanCode ? (
          <Link className="bd-labo-link" to={planHref(row)}>
            {row.treatmentPlanCode}
          </Link>
        ) : (
          dash(undefined)
        ),
    },
    {
      key: "sentDue",
      title: t("Labo:Column:SentDue"),
      width: 150,
      render: (_, row) => <LaboSendDueCell order={row} />,
    },
    {
      key: "status",
      title: t("Common:Status"),
      width: 160,
      render: (_, row) => {
        const pill = laboStatusPill(row);
        return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
      },
    },
    {
      key: "dentistName",
      title: t("Labo:Orders:DentistAssigned"),
      width: 150,
      render: (_, row) => dash(row.dentistName),
    },
    {
      key: "materialName",
      title: t("Labo:Orders:Material"),
      width: 150,
      render: (_, row) => dash(row.materialName),
    },
    {
      key: "toothNumbers",
      title: t("Labo:Orders:Teeth"),
      width: 100,
      render: (_, row) => dash(row.toothNumbers),
    },
    {
      key: "attachment",
      title: t("Labo:Orders:ClinicFile"),
      width: 168,
      align: "center",
      render: (_, row) => (
        <LaboImagesButton images={row.images} label={t("Labo:Orders:ViewClinicFile")} />
      ),
    },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 112,
      align: "center",
      fixed: "right",
      render: (_, row) => <LaboRowActions row={row} detailLabel={t("Patient:Labo:View")} onDetail={onDetail} />,
    },
  ];
}
