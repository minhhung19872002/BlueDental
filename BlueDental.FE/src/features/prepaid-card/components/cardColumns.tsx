import { Button } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import type { CardDto } from "../types";
import { CardStateTag } from "./CardStateTag";

/** "Đã dùng 2/5 lần" — or just the count when the card has no limit. */
export function usesText(card: Pick<CardDto, "usedCount" | "maxUses">): string {
  return card.maxUses ? `${card.usedCount}/${card.maxUses}` : String(card.usedCount);
}

/** Tab "Thẻ đã phát hành" — Tình trạng thẻ (cụm 3 mục 2). "Xem" in the sticky Thao tác column opens the card. */
export function cardColumns(onOpen: (card: CardDto) => void): ColumnsType<CardDto> {
  return [
    {
      title: t("PrepaidCard:Col:Code"),
      dataIndex: "code",
      fixed: "left",
      width: 130,
      render: (code: string) => <b className="prepaid-code">{code}</b>,
    },
    { title: t("PrepaidCard:Field:CardType"), dataIndex: "name", width: 180, ellipsis: true },
    {
      title: t("PrepaidCard:Field:Owner"),
      key: "owner",
      width: 220,
      render: (_, card) => (
        <span>
          {card.ownerName ?? "—"}
          {card.ownerCode ? <small className="prepaid-muted"> · {card.ownerCode}</small> : null}
        </span>
      ),
    },
    {
      title: t("PrepaidCard:Col:Members"),
      key: "members",
      align: "center",
      width: 100,
      render: (_, card) => (card.allowFamily ? card.members.length : "—"),
    },
    {
      title: t("PrepaidCard:Col:Balance"),
      key: "balance",
      align: "right",
      width: 190,
      render: (_, card) => (
        <span>
          <b>{formatVND(card.balance)}</b>
          <small className="prepaid-muted"> / {formatVND(card.totalLoaded)}</small>
        </span>
      ),
    },
    { title: t("PrepaidCard:Col:Uses"), key: "uses", align: "center", width: 100, render: (_, card) => usesText(card) },
    { title: t("PrepaidCard:Field:Seller"), dataIndex: "sellerName", width: 160, ellipsis: true },
    { title: t("PrepaidCard:Col:SoldAt"), dataIndex: "soldAt", width: 120, render: (value: string) => formatDate(value) },
    {
      title: t("PrepaidCard:Col:ExpiresOn"),
      dataIndex: "expiresOn",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : t("PrepaidCard:NoExpiry")),
    },
    { title: t("Common:Status"), key: "state", width: 150, render: (_, card) => <CardStateTag card={card} /> },
    {
      title: t("Common:Actions"),
      key: "actions",
      fixed: "right",
      width: 110,
      align: "center",
      render: (_, card) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          aria-label={t("PrepaidCard:ViewCard", card.code)}
          onClick={() => onOpen(card)}
        >
          {t("PrepaidCard:View")}
        </Button>
      ),
    },
  ];
}
