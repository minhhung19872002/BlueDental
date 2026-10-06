import { Button, Table, Tag } from "antd";
import { DeleteOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { ComboRow } from "../hooks/useComboComponents";

interface Props {
  rows: ComboRow[];
  retailTotal: number;
  comboPrice: number;
  onQuantityChange: (id: string, quantity: number) => void;
  onUnitAmountChange: (id: string, unitAmount: number) => void;
  onRemove: (id: string) => void;
}

/** Columns up to and including "Thành tiền": the totals line spans them. */
const TOTALS_SPAN = 4;

/**
 * "Thành phần combo": one row per service, its quantity, its own price and the
 * price it carries inside this combo. Only the last two figures differ — and
 * only the combo's row changes when "Thành tiền" is edited.
 */
export function ComboComponentTable({
  rows,
  retailTotal,
  comboPrice,
  onQuantityChange,
  onUnitAmountChange,
  onRemove,
}: Props) {
  const columns: ColumnsType<ComboRow> = [
    {
      key: "name",
      title: t("Taxonomy:Combo:ColComponent"),
      render: (_, row) => (
        <div className="bd-combo-name">
          <Tag className="bd-combo-tag">{t("Taxonomy:Combo:ServiceTag")}</Tag>
          <span className={row.isDeleted ? "bd-cat-name--deleted" : undefined}>{row.name}</span>
          {row.isDeleted && <Tag color="red">{t("Taxonomy:Catalog:IsDeleted")}</Tag>}
        </div>
      ),
    },
    {
      key: "quantity",
      title: t("Taxonomy:Combo:ColQuantity"),
      width: 128,
      render: (_, row) => (
        <div className="bd-combo-qty">
          <Button
            size="small"
            icon={<MinusOutlined />}
            aria-label={t("Taxonomy:Combo:DecreaseAria", row.name)}
            disabled={row.quantity <= 1}
            onClick={() => onQuantityChange(row.componentEntryId, row.quantity - 1)}
          />
          <span className="bd-combo-qty-value">{row.quantity}</span>
          <Button
            size="small"
            icon={<PlusOutlined />}
            aria-label={t("Taxonomy:Combo:IncreaseAria", row.name)}
            onClick={() => onQuantityChange(row.componentEntryId, row.quantity + 1)}
          />
        </div>
      ),
    },
    {
      key: "unitPrice",
      title: t("Taxonomy:Combo:ColUnitPrice"),
      width: 130,
      align: "right",
      render: (_, row) => <span className="bd-muted-text">{formatVND(row.unitPrice)}</span>,
    },
    {
      key: "unitAmount",
      title: t("Taxonomy:Combo:ColUnitAmount"),
      width: 150,
      align: "right",
      render: (_, row) => (
        <CurrencyInput
          className="bd-combo-amount"
          aria-label={t("Taxonomy:Combo:UnitAmountAria", row.name)}
          value={row.unitAmount}
          onChange={(next) => onUnitAmountChange(row.componentEntryId, next ?? 0)}
        />
      ),
    },
    {
      key: "actions",
      width: 48,
      render: (_, row) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label={t("Common:DeleteAriaLabel", row.name)}
          onClick={() => onRemove(row.componentEntryId)}
        />
      ),
    },
  ];

  return (
    <Table<ComboRow>
      className="bd-stage-table bd-combo-table"
      rowKey="componentEntryId"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={false}
      locale={{ emptyText: t("Taxonomy:Combo:Empty") }}
      summary={() => (
        <Table.Summary>
          <Table.Summary.Row className="bd-combo-sum-row">
            <Table.Summary.Cell index={0} colSpan={TOTALS_SPAN}>
              <div className="bd-combo-sums">
                <SummaryFigure label={t("Taxonomy:Combo:RetailTotal")} amount={retailTotal} />
                <SummaryFigure label={t("Taxonomy:Combo:ComboTotal")} amount={comboPrice} strong />
              </div>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={TOTALS_SPAN} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}

/** One figure of the totals line, its label just left of its amount. */
function SummaryFigure({
  label,
  amount,
  strong,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <span className={strong ? "bd-combo-sum bd-combo-sum--strong" : "bd-combo-sum"}>
      <span>{label}</span>
      <span className="bd-combo-sum-amount">{t("Taxonomy:Combo:Amount", formatVND(amount))}</span>
    </span>
  );
}
