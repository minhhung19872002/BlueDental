import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { CardSummaryDto } from "../types";

interface Props {
  summary: CardSummaryDto | undefined;
}

/** The four figures above the card list, for the branch picked in the header. */
export function CardSummaryTiles({ summary }: Props) {
  const tiles = [
    {
      key: "usable",
      label: t("PrepaidCard:Summary:Usable"),
      value: summary ? `${summary.usableCount} / ${summary.cardCount}` : "—",
    },
    { key: "balance", label: t("PrepaidCard:Summary:Balance"), value: formatVND(summary?.outstandingBalance ?? 0) },
    { key: "received", label: t("PrepaidCard:Summary:Received"), value: formatVND(summary?.moneyReceived ?? 0) },
    { key: "commission", label: t("PrepaidCard:Summary:Commission"), value: formatVND(summary?.commissionTotal ?? 0) },
  ];

  return (
    <div className="prepaid-tiles">
      {tiles.map((tile) => (
        <div key={tile.key} className="prepaid-tile">
          <span>{tile.label}</span>
          <strong>{tile.value}</strong>
        </div>
      ))}
    </div>
  );
}
