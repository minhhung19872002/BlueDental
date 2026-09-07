import { Checkbox, Select } from "antd";
import type { TableColumnsType } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DataTable } from "@/components/DataTable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { TAX_TYPE_OPTIONS } from "./invoiceConstants";
import { InvoiceServiceCard } from "./InvoiceServiceCard";
import type { InvoiceServiceRow } from "./invoiceTypes";

interface InvoiceServiceTableProps {
  rows: InvoiceServiceRow[];
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (key: string, checked: boolean) => void;
  onTaxTypeChange: (key: string, taxType: string) => void;
  onUnitPriceChange: (key: string, price: number | undefined) => void;
}

const NARROW_SCREEN = "(max-width: 640px)";

export function InvoiceServiceTable({
  rows,
  allSelected,
  onToggleAll,
  onToggleRow,
  onTaxTypeChange,
  onUnitPriceChange,
}: InvoiceServiceTableProps) {
  const narrow = useMediaQuery(NARROW_SCREEN);

  const columns: TableColumnsType<InvoiceServiceRow> = [
    {
      title: <Checkbox checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />,
      key: "select",
      width: 48,
      align: "center",
      render: (_, row) => (
        <Checkbox
          checked={row.selected}
          onChange={(e) => onToggleRow(row.key, e.target.checked)}
        />
      ),
    },
    { title: t("STT"), dataIndex: "stt", key: "stt", width: 60, align: "center" },
    {
      title: t("Tên hàng"),
      key: "serviceName",
      width: 220,
      render: (_, row) => (
        <div className="inv-service-name">
          <span>{row.serviceName}</span>
          <Select
            value={row.taxType}
            onChange={(v) => onTaxTypeChange(row.key, v)}
            options={TAX_TYPE_OPTIONS()}
            size="small"
            className="inv-tax-select"
          />
        </div>
      ),
    },
    { title: t("Đơn vị"), dataIndex: "unit", key: "unit", width: 80 },
    { title: t("Số lượng"), dataIndex: "quantity", key: "quantity", width: 80, align: "center" },
    {
      title: t("Đơn giá"),
      key: "unitPrice",
      width: 140,
      render: (_, row) => (
        <CurrencyInput
          className="inv-price-input"
          value={row.unitPrice}
          onChange={(v) => onUnitPriceChange(row.key, v)}
        />
      ),
    },
    {
      title: t("Giá tính thuế"),
      dataIndex: "taxBasePrice",
      key: "taxBasePrice",
      width: 120,
      align: "right",
      render: (value: number) => formatVND(value),
    },
    {
      title: t("% thuế"),
      dataIndex: "taxPercent",
      key: "taxPercent",
      width: 80,
      align: "center",
      render: (value: string) => {
        const opt = TAX_TYPE_OPTIONS().find((o) => o.value === value);
        return opt?.label ?? value;
      },
    },
    {
      title: t("Tiền thuế"),
      dataIndex: "taxAmount",
      key: "taxAmount",
      width: 100,
      align: "right",
      render: (value: number) => `${formatVND(value)} ${t("đ")}`,
    },
    {
      title: t("Thành tiền sau thuế"),
      dataIndex: "totalAfterTax",
      key: "totalAfterTax",
      width: 150,
      align: "right",
      render: (value: number) => formatVND(value),
    },
  ];

  if (narrow) {
    return (
      <div className="inv-table inv-cards-mobile">
        <div className="inv-cards-header">
          <Checkbox checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)}>
            {t("Chọn tất cả")}
          </Checkbox>
        </div>
        {rows.map((row) => (
          <InvoiceServiceCard
            key={row.key}
            row={row}
            onToggle={(checked) => onToggleRow(row.key, checked)}
            onTaxTypeChange={(taxType) => onTaxTypeChange(row.key, taxType)}
            onUnitPriceChange={(price) => onUnitPriceChange(row.key, price)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="inv-table bd-cat-card">
      <DataTable<InvoiceServiceRow>
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={{
          total: rows.length,
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total: number, range: [number, number]) =>
            t("Hiển thị {0} trên {1}", `${range[0]}`, `${total}`),
        }}
        locale={{ emptyText: t("Chưa có dịch vụ") }}
      />
    </div>
  );
}
