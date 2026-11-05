import type { TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyCardPhotos, type WarrantyCardUrls } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { draftPill, type LaboWarrantyDraft } from "./laboWarrantyDraft";
import {
  cardEndDate,
  formatCardDate,
  LABO_WARRANTY_STATE_PILL,
  typedDurationText,
  warrantyState,
} from "./laboWarrantyRules";

export interface LaboWarrantyRow {
  tooth: LaboOrderToothDto;
  code: string;
  /** Ảnh thẻ bảo hành sent with the activation (P3110 REQ-E1). */
  cardPhotos: WarrantyCardUrls;
  /** Not yet activated: its card as typed so far in Kích hoạt bảo hành (R-1152). */
  draft?: LaboWarrantyDraft;
}

const startOf = (row: LaboWarrantyRow) =>
  row.draft ? row.draft.card?.startDate?.format("YYYY-MM-DD") : row.tooth.warrantyStartDate;
const endOf = (row: LaboWarrantyRow) =>
  row.draft ? cardEndDate(row.draft.card)?.format("YYYY-MM-DD") : row.tooth.warrantyEndDate;
const monthsOf = (row: LaboWarrantyRow) =>
  row.draft ? row.draft.card?.months : (row.tooth.warrantyMonths ?? undefined);

function stateBadge(row: LaboWarrantyRow) {
  const pill = row.draft ? draftPill(row.draft) : LABO_WARRANTY_STATE_PILL[warrantyState(row.tooth)];
  return <StatusBadge label={row.draft ? pill.label : t(pill.label)} bg={pill.bg} color={pill.color} />;
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
      render: (_, row) => formatCardDate(startOf(row)),
    },
    { title: t("Labo:Warranty:Table:End"), key: "end", width: 92, render: (_, row) => formatCardDate(endOf(row)) },
    {
      title: t("Labo:Warranty:Table:Duration"),
      key: "duration",
      width: 96,
      render: (_, row) => (monthsOf(row) ? typedDurationText(monthsOf(row)) : formatCardDate(null)),
    },
    // Lần BH counts the Tiếp nhận bảo hành rounds, which come in a later phase.
    { title: t("Labo:Warranty:Table:Claims"), key: "claims", width: 70, align: "center", render: () => 0 },
    {
      title: t("Labo:Warranty:Table:Photos"),
      key: "photos",
      width: 116,
      render: (_, row) =>
        Object.keys(row.cardPhotos).length > 0 ? (
          <WarrantyCardPhotos urls={row.cardPhotos} compact />
        ) : (
          t("Labo:Warranty:Table:NoPhoto")
        ),
    },
    { title: t("Labo:Warranty:Table:State"), key: "state", width: 150, render: (_, row) => stateBadge(row) },
  ];
}

/**
 * Răng · Mã thẻ · Bắt đầu · Hết hạn · Thời hạn · Lần BH · Ảnh thẻ · Trạng thái
 * (BA mock BaoHanhV2), one row per Đạt tooth — a tooth not yet activated as
 * typed so far; `focusTooth`'s row marked (R-1120).
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
