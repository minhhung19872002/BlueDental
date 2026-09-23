// StockAdjustmentModal — records stock-in, stock-out, or adjustment transactions.

import { toast } from "sonner";
import { Modal, Button, Form, Select, Input, InputNumber } from "antd";
import { useAdjustStock, useInventoryList } from "../api/index";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected inventory item id. When omitted the user picks from the list. */
  itemId?: string;
}

interface AdjustmentFormValues {
  itemId: string;
  adjustmentType: "stock_in" | "stock_out" | "inventory";
  quantity: number;
  reason: string;
}

export function StockAdjustmentModal({ open, onClose, itemId }: Props) {

  const ADJUSTMENT_TYPE_OPTIONS = [
    { value: "stock_in",  label: t("Inventory:StockIn") },
    { value: "stock_out", label: t("Inventory:StockOut") },
    { value: "inventory", label: t("Inventory:StockCount") },
  ];

  const [form] = Form.useForm<AdjustmentFormValues>();

  const adjustStock = useAdjustStock();
  const { data: inventoryPage, isLoading: inventoryLoading } = useInventoryList({
    maxResultCount: 100,
  });

  const itemOptions = (inventoryPage?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.itemCode}) — ${t("Inventory:CurrentStock")}: ${item.currentStock} ${item.unit}`,
  }));

  const handleSubmit = async () => {
    let values: AdjustmentFormValues;
    try {
      values = await form.validateFields();
    } catch {
      // validation errors shown inline
      return;
    }

    const resolvedItemId = itemId ?? values.itemId;
    // positive delta for stock_in, negative for stock_out, 0-based diff for inventory
    const delta =
      values.adjustmentType === "stock_out" ? -values.quantity : values.quantity;

    adjustStock.mutate(
      { id: resolvedItemId, adjustment: delta, note: values.reason },
      {
        onSuccess: () => {
          toast.success(t("Inventory:AdjustSuccess"));
          form.resetFields();
          onClose();
        },
      },
    );
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={t("Inventory:AdjustTitle")}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t("Common:Cancel")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={adjustStock.isPending}
            style={{ background: "var(--bd-blue)" }}
          >
            {t("Inventory:SaveAdjust")}
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          requiredMark={false}
        >
          {!itemId && (
            <Form.Item
              name="itemId"
              label={t("Inventory:Material")}
              rules={[{ required: true, message: t("Inventory:SelectMaterialRequired") }]}
            >
              <Select
                showSearch
                placeholder={t("Inventory:SearchMaterial")}
                loading={inventoryLoading}
                options={itemOptions}
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}

          <Form.Item
            name="adjustmentType"
            label={t("Inventory:AdjustType")}
            rules={[{ required: true, message: t("Inventory:SelectAdjustTypeRequired") }]}
          >
            <Select
              placeholder={t("Inventory:SelectAdjustType")}
              options={ADJUSTMENT_TYPE_OPTIONS}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={t("Inventory:Quantity")}
            rules={[
              { required: true, message: t("Inventory:QuantityRequired") },
              { type: "number", min: 1, message: t("Inventory:QuantityMin") },
            ]}
          >
            <InputNumber
              placeholder="0"
              min={1}
              style={{ width: "100%" }}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label={t("Inventory:Reason")}
            rules={[{ required: true, message: t("Inventory:ReasonRequired") }]}
          >
            <Input.TextArea
              placeholder={t("Inventory:ReasonPlaceholder")}
              rows={3}
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
