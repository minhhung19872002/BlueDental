import type { TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyCardPhotos, type WarrantyCardUrls } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { formatCardDate, LABO_WARRANTY_STATE_PILL, remainingLabel, warrantyState } from "./laboWarrantyRules";

export interface LaboWarrantyRow {
  tooth: LaboOrderToothDto;
  code: string;
  /** Ảnh thẻ bảo hành sent with the activation (P3110 REQ-E1). */
  cardPhotos: WarrantyCardUrls;
}

function buildColumns(): TableColumnsType<LaboWarrantyRow> {
  return [
    { title: t("Labo:Warranty:Table:Tooth"), key: "tooth", width: 64, render: (_, row) => row.tooth.toothNumber },
    {
      title: t("Labo:Warranty:Table:Code"),
      key: "code",
      width: 144,
      render: (_, row) => <span className="pd-labo-warranty-code">{row.code}</span>,
    },
    {
      title: t("Labo:Warranty:Table:Start"),
      key: "start",
      width: 92,
      render: (_, row) => formatCardDate(row.tooth.warrantyStartDate),
    },
    {
      title: t("Labo:Warranty:Table:End"),
      key: "end",
      width: 92,
      render: (_, row) => formatCardDate(row.tooth.warrantyEndDate),
    },
    {
      title: t("Labo:Warranty:Table:Left"),
      key: "left",
      width: 108,
      render: (_, row) => {
        // Trạng thái already says Chưa kích hoạt; a dash keeps the column on one line.
        if (!row.tooth.warrantyEndDate) return formatCardDate(null);
        const left = remainingLabel(row.tooth.warrantyEndDate);
        return t(left.key, ...left.args);
      },
    },
    // Lần BH counts the Tiếp nhận bảo hành rounds, which come in a later phase.
    { title: t("Labo:Warranty:Table:Claims"), key: "claims", width: 70, align: "center", render: () => 0 },
    {
      title: t("Labo:Warranty:Table:Photos"),
      key: "photos",
      width: 116,
      render: (_, row) =>
        Object.keys(row.cardPhotos).length > 0 ? <WarrantyCardPhotos urls={row.cardPhotos} compact /> : formatCardDate(null),
    },
    {
      title: t("Labo:Warranty:Table:State"),
      key: "state",
      width: 116,
      render: (_, row) => {
        const pill = LABO_WARRANTY_STATE_PILL[warrantyState(row.tooth)];
        return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
      },
    },
  ];
}

/**
 * Răng · Mã thẻ · Bắt đầu · Hết hạn · Còn lại · Lần BH · Ảnh thẻ · Trạng thái,
 * one row per Đạt tooth; `focusTooth`'s row marked (R-1120).
 */
export function LaboWarrantyTable({ rows, focusTooth }: { rows: LaboWarrantyRow[]; focusTooth?: number | null }) {
  return (
    <DataTable<LaboWarrantyRow>
      rowKey={(row) => row.tooth.toothNumber}
      size="small"
      className="pd-labo-warranty-table"
      rowClassName={(row) => (row.tooth.toothNumber === focusTooth ? "pd-labo-warranty-row--focus" : "")}
      columns={buildColumns()}
      dataSource={rows}
      pagination={false}
    />
  );
}
