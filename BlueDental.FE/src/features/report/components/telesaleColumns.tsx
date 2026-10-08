import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { TelesaleBreakdownRowDto, TelesaleFileRowDto } from "../api/customerReportApi";
import { countColumn, rateColumn } from "./reportCountColumns";
import { bookingRate } from "./telesaleReportConfig";

/** A breakdown row with the name it is shown under ("Không rõ nguồn", "Khách cũ", …). */
export type NamedTelesaleRow<T extends TelesaleBreakdownRowDto = TelesaleBreakdownRowDto> = T & {
  rowKey: string;
  label: string;
};

/** Ticket states + Quá hạn + Tỉ lệ đặt lịch, shared by every telesale table. */
function statusColumns<T extends TelesaleBreakdownRowDto>(): ColumnsType<T> {
  return [
    countColumn<T>("total", t("Report:Telesale:Total"), "ink"),
    countColumn<T>("new", t("Ticket:Status:New")),
    countColumn<T>("inCare", t("Ticket:Status:InCare")),
    countColumn<T>("booked", t("Ticket:Status:Booked"), "blue"),
    countColumn<T>("arrived", t("Ticket:Status:Arrived"), "green"),
    countColumn<T>("notPotential", t("Ticket:Status:NotPotential")),
    countColumn<T>("overdue", t("Report:Telesale:Overdue"), "red"),
    rateColumn<T>(t("Report:Telesale:ConversionShort"), bookingRate),
  ];
}

export function breakdownColumns(nameTitle: string): ColumnsType<NamedTelesaleRow> {
  return [
    { key: "label", dataIndex: "label", title: nameTitle, fixed: "left", width: 220, ellipsis: true },
    ...statusColumns<NamedTelesaleRow>(),
  ];
}

export function fileColumns(): ColumnsType<NamedTelesaleRow<TelesaleFileRowDto>> {
  type Row = NamedTelesaleRow<TelesaleFileRowDto>;
  return [
    { key: "label", dataIndex: "label", title: t("Report:Telesale:File"), fixed: "left", width: 240, ellipsis: true },
    {
      key: "importedAt",
      dataIndex: "importedAt",
      title: t("Report:Telesale:ImportedAt"),
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    countColumn<Row>("rowCount", t("Report:Telesale:Rows")),
    countColumn<Row>("createdCount", t("Report:Telesale:Created")),
    countColumn<Row>("reoccurredCount", t("Report:Telesale:Reoccurred")),
    ...statusColumns<Row>(),
  ];
}
