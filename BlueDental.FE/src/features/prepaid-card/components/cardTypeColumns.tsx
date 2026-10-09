import { Button, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { COMMISSION_TYPE, type CardTypeDto } from "../types";
import { scopeSummary } from "./ServiceScopeFields";

export interface CardTypeRowActions {
  onEdit?: (type: CardTypeDto) => void;
  onDelete?: (type: CardTypeDto) => void;
}

const commissionText = (type: CardTypeDto) =>
  type.commissionType === COMMISSION_TYPE.Percent ? `${type.commissionValue}%` : formatVND(type.commissionValue);

/** Tab "Loại thẻ": the terms a card is sold with. */
export function cardTypeColumns({ onEdit, onDelete }: CardTypeRowActions): ColumnsType<CardTypeDto> {
  const columns: ColumnsType<CardTypeDto> = [
    { title: t("PrepaidCard:Field:TypeName"), dataIndex: "name", width: 220, fixed: "left" },
    { title: t("PrepaidCard:Field:SalePrice"), dataIndex: "salePrice", align: "right", render: formatVND },
    { title: t("PrepaidCard:Field:UsageValue"), dataIndex: "usageValue", align: "right", render: formatVND },
    {
      title: t("PrepaidCard:Field:MaxUses"),
      dataIndex: "maxUses",
      align: "right",
      render: (value: number | null) => value ?? t("PrepaidCard:Unlimited"),
    },
    {
      title: t("PrepaidCard:Field:Validity"),
      dataIndex: "validityMonths",
      align: "right",
      render: (value: number | null) => (value ? `${value} ${t("PrepaidCard:Months")}` : t("PrepaidCard:NoExpiry")),
    },
    { title: t("PrepaidCard:Field:Commission"), key: "commission", align: "right", render: (_, row) => commissionText(row) },
    {
      title: t("PrepaidCard:Field:AllowFamily"),
      dataIndex: "allowFamily",
      align: "center",
      render: (value: boolean) => (value ? t("Common:Yes") : t("Common:No")),
    },
    { title: t("PrepaidCard:Field:Scope"), key: "scope", render: (_, row) => scopeSummary(row) },
    { title: t("PrepaidCard:Col:Sold"), dataIndex: "soldCount", align: "right" },
    {
      title: t("Common:Status"),
      dataIndex: "isOnSale",
      render: (value: boolean) =>
        value ? <Tag color="green">{t("PrepaidCard:OnSale")}</Tag> : <Tag>{t("PrepaidCard:OffSale")}</Tag>,
    },
  ];

  if (!onEdit && !onDelete) return columns;

  return [
    ...columns,
    {
      title: t("Common:Actions"),
      key: "actions",
      fixed: "right",
      width: 110,
      align: "center",
      render: (_, row) => (
        <span className="prepaid-row-actions">
          {onEdit ? (
            <Tooltip title={t("Common:Edit")}>
              <Button type="text" size="small" icon={<EditOutlined />} aria-label={t("Common:Edit")} onClick={() => onEdit(row)} />
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip title={t("Common:Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Common:Delete")}
                onClick={() => onDelete(row)}
              />
            </Tooltip>
          ) : null}
        </span>
      ),
    },
  ];
}
