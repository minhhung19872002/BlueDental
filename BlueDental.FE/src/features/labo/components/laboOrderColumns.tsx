import { Link } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  LABO_KIND_CONFIG,
  LABO_STATUS_CONFIG,
  type LaboOrderDto,
} from "../api/laboApi";
import {
  LaboDatePill,
  LaboImagesButton,
  LaboRowActions,
  type LaboRowActionHandlers,
} from "./order-dialogs/laboOrderCells";

interface Options extends LaboRowActionHandlers {
  /** Rides on the patient and treatment-slip links, as on the reference. */
  branchId: string;
}

const dash = (value: string | undefined) => value ?? <span className="bd-cat-num">—</span>;

/**
 * Mẫu Labo — the reference's eleven columns (docs/clone/pages/labo.md §2.4):
 * the code, the supplier over its creation date, the customer and the
 * treatment slip as links into the patient record, the two date/pill pairs,
 * the dentist, material and teeth, the returned-file folder and Thao tác.
 */
export function buildLaboOrderColumns({ branchId, ...actions }: Options): ColumnsType<LaboOrderDto> {
  const patientHref = (row: LaboOrderDto) => `/patient/${row.patientId}?branchId=${branchId}`;
  const planHref = (row: LaboOrderDto) =>
    `/patient/${row.patientId}/treatment-plan/${row.treatmentPlanId}?branchId=${branchId}`;

  return [
    {
      key: "orderCode",
      title: t("Patient:Labo:Code"),
      width: 150,
      render: (_, row) => <span className="pd-labo-code">{row.orderCode}</span>,
    },
    {
      key: "supplier",
      title: t("Labo:Orders:SupplierCreatedAt"),
      width: 200,
      render: (_, row) => (
        <div className="bd-labo-stack">
          <p className="bd-cat-name">{row.supplierName ?? row.labProviderName}</p>
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
      width: 130,
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
      key: "sentAt",
      title: t("Patient:Labo:SentDateStatus"),
      width: 175,
      render: (_, row) => <LaboDatePill date={row.sentAt} pill={LABO_KIND_CONFIG[row.kind]} />,
    },
    {
      key: "dueAt",
      title: t("Patient:Labo:DeliveryStatus"),
      width: 175,
      render: (_, row) => <LaboDatePill date={row.dueAt} pill={LABO_STATUS_CONFIG[row.status]} />,
    },
    {
      key: "dentistName",
      title: t("Labo:Orders:DentistAssigned"),
      width: 160,
      render: (_, row) => dash(row.dentistName),
    },
    {
      key: "materialName",
      title: t("Labo:Orders:Material"),
      width: 160,
      render: (_, row) => dash(row.materialName),
    },
    {
      key: "toothNumbers",
      title: t("Labo:Orders:Teeth"),
      width: 110,
      render: (_, row) => dash(row.toothNumbers),
    },
    {
      key: "attachment",
      title: t("Labo:Orders:ClinicFile"),
      width: 150,
      align: "center",
      render: (_, row) => (
        <LaboImagesButton images={row.images} label={t("Labo:Orders:ViewClinicFile")} />
      ),
    },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 140,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <LaboRowActions
          row={row}
          detailLabel={t("Patient:Labo:View")}
          onDetail={actions.onDetail}
          onContinue={actions.onContinue}
          onWarranty={actions.onWarranty}
        />
      ),
    },
  ];
}
