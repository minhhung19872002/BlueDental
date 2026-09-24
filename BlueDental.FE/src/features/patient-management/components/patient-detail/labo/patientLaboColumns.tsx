import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import {
  LABO_KIND_CONFIG,
  LABO_STATUS_CONFIG,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";
import {
  LaboDatePill,
  LaboImagesButton,
  LaboRowActions,
  type LaboRowActionHandlers,
} from "@/features/labo/components/order-dialogs/laboOrderCells";

const dash = (value: string | undefined) => value ?? "—";

/**
 * The patient's Labo table. Ngày gửi carries the kind pill and Ngày giao the
 * status pill, File Labo is the folder the reference draws, and Thao tác
 * opens the read-only detail or raises the two child orders on the row. The
 * cells are the ones Mẫu Labo draws too (features/labo).
 */
export function buildPatientLaboColumns(actions: LaboRowActionHandlers): TableColumnsType<LaboOrderDto> {
  return [
    {
      title: t("Patient:Labo:Code"),
      dataIndex: "orderCode",
      width: 150,
      render: (value: string) => <span className="pd-labo-code">{value}</span>,
    },
    {
      title: t("Patient:Labo:SentDateStatus"),
      dataIndex: "sentAt",
      width: 175,
      render: (value: string | undefined, row) => (
        <LaboDatePill date={value} pill={LABO_KIND_CONFIG[row.kind]} />
      ),
    },
    {
      title: t("Patient:Labo:DeliveryStatus"),
      dataIndex: "dueAt",
      width: 175,
      render: (value: string | undefined, row) => (
        <LaboDatePill date={value} pill={LABO_STATUS_CONFIG[row.status]} />
      ),
    },
    { title: t("Patient:QuoteSheet:PrescribingDoctor"), dataIndex: "dentistName", width: 140, render: dash },
    { title: t("Patient:Labo:Supplier"), dataIndex: "labProviderName", width: 140, render: dash },
    { title: t("Patient:Labo:Material"), dataIndex: "materialName", render: dash },
    { title: t("Patient:DentalChart:ToothNumber"), dataIndex: "toothNumbers", width: 100, render: dash },
    { title: t("Patient:Payment:Quantity"), dataIndex: "quantity", width: 100, align: "center" },
    {
      title: t("Patient:Labo:ReturnFile"),
      dataIndex: "images",
      width: 130,
      align: "center",
      render: (value: LaboOrderDto["images"]) => (
        <LaboImagesButton images={value} label={t("Patient:Labo:ViewFile")} />
      ),
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 130,
      align: "center",
      fixed: "right",
      render: (_, row) => <LaboRowActions row={row} {...actions} />,
    },
  ];
}
