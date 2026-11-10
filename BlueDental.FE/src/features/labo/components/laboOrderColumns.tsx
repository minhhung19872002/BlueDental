import { Link } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { StatusBadge } from "@/components/StatusBadge";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { isWarrantyCardPhoto, laboOrderNo, type LaboOrderDto } from "../api/laboApi";
import { laboStatusPill } from "../api/laboStatus";
import { LaboSendDueCell } from "./order-dialogs/LaboSendDueCell";
import { LaboImagesButton, LaboRowActions, type LaboRowActionHandlers } from "./order-dialogs/laboOrderCells";
import { laboWorkOf } from "./order-dialogs/laboRequestSlipText";

interface Options extends Pick<LaboRowActionHandlers, "onDetail"> {
  /** Rides on the patient link, as on the reference. */
  branchId: string;
}

const dash = (value: string | undefined) => value ?? <span className="bd-cat-num">—</span>;

/**
 * Mẫu Labo — the reference's columns (docs/clone/pages/labo.md §2.4) with
 * P2910_03's Gửi → Hẹn giao and Trạng thái in place of the two date/pill
 * pairs: the Mã số (the Labo's own slip number since F-91, else the order
 * code), its creation date — F-91 dropped the supplier — the customer as a
 * link into the patient record (P1011 dropped the treatment slip), the dentist, Loại phục hình
 * and teeth, the returned-file folder and Thao tác (Xem only — the workflow
 * runs on the patient record).
 */
export function buildLaboOrderColumns({ branchId, onDetail }: Options): ColumnsType<LaboOrderDto> {
  const patientHref = (row: LaboOrderDto) => withBranch(`/patient/${row.patientId}`, branchId);

  return [
    {
      key: "orderCode",
      title: t("Labo:Slip:SlipNo"),
      width: 132,
      render: (_, row) => <span className="pd-labo-code">{laboOrderNo(row)}</span>,
    },
    {
      key: "createdAt",
      title: t("Common:CreatedAt"),
      width: 112,
      render: (_, row) => formatDate(row.creationTime),
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
      title: t("Patient:Labo:ProsthesisType"),
      width: 180,
      render: (_, row) => dash(laboWorkOf(row) || undefined),
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
        <LaboImagesButton images={row.images.filter((image) => !isWarrantyCardPhoto(image))} label={t("Labo:Orders:ViewClinicFile")} />
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
