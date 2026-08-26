import { Checkbox, Input, InputNumber } from "antd";
import { Shuffle } from "lucide-react";
import { t } from "@/lib/i18n";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import type { BatchVoucherItem, VoucherBatchState } from "../hooks/useVoucherBatch";

interface CardProps {
  item: BatchVoucherItem;
  index: number;
  selected: boolean;
  prefixLabel: string;
  onSelect: (index: number) => void;
  onRename: (index: number, name: string) => void;
}

function BatchCard({ item, index, selected, prefixLabel, onSelect, onRename }: CardProps) {
  const className = [
    "voucher-batch-card",
    selected && "voucher-batch-card--selected",
    item.nameError && "voucher-batch-card--error",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(index);
      }}
    >
      <div className="voucher-batch-card-head">
        <span className="voucher-batch-card-index">#{index + 1}</span>
        <span className="voucher-batch-card-code">{prefixLabel}{item.code}</span>
      </div>
      <div className="voucher-batch-card-name">
        <Input
          aria-label={t("Tên voucher #{0}", index + 1)}
          value={item.name}
          status={item.nameError ? "error" : undefined}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRename(index, e.target.value)}
        />
        {!item.name && (
          <span className="voucher-batch-name-placeholder">
            {t("Tên voucher")}
            <span className="voucher-required-star">*</span>
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  batch: VoucherBatchState;
  prefixLabel: string;
}

export function VoucherBatchTab({ batch, prefixLabel }: Props) {
  const { items, configAll, selectedIndex } = batch;

  return (
    <>
      <div className="voucher-batch-count">
        <FloatingField
          name="batchCount"
          label={t("Nhập số lượng mã (tối đa 100)")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập số lượng") }]}
        >
          <InputNumber<number> min={1} max={100} controls={false} onChange={batch.setCount} />
        </FloatingField>
      </div>

      <div className="voucher-batch-header">
        <span>{t("Chọn mã để cấu hình riêng")}</span>
        <Checkbox
          checked={configAll}
          onChange={(e) => batch.toggleConfigAll(e.target.checked)}
        >
          {t("Cấu hình tất cả")}
        </Checkbox>
      </div>

      <div className="voucher-batch-cards">
        {items.map((item, i) => (
          <BatchCard
            key={i}
            item={item}
            index={i}
            selected={configAll || i === selectedIndex}
            prefixLabel={prefixLabel}
            onSelect={batch.selectItem}
            onRename={batch.renameItem}
          />
        ))}
      </div>

      <div className="voucher-batch-config-row">
        {!configAll && (
          <FloatingField name="batchCode" label={t("Mã ngẫu nhiên")} className="voucher-code-field">
            <Input
              addonBefore={prefixLabel}
              onChange={(e) => batch.changeSelectedCode(e.target.value)}
              suffix={
                <button
                  type="button"
                  className="voucher-shuffle-btn"
                  aria-label={t("Tạo mã ngẫu nhiên")}
                  onClick={batch.shuffleSelectedCode}
                >
                  <Shuffle size={16} />
                </button>
              }
            />
          </FloatingField>
        )}
        <FloatingField
          name="usageLimit"
          label={t("Nhập số lượt tối đa")}
          required
          rules={[
            { required: true, message: t("Vui lòng nhập số lượt") },
            { type: "number", min: 1, message: t("Số lượt phải lớn hơn 0") },
          ]}
        >
          <CurrencyInput />
        </FloatingField>
      </div>

      {!configAll && (
        <div className="voucher-form-hint voucher-batch-hint">
          {t("Chỉ chữ in hoa, số, dấu gạch ngang. Để trống để tạo tự động.")}
        </div>
      )}
    </>
  );
}
