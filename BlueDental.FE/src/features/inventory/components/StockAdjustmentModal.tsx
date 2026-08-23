// StockAdjustmentModal — records stock-in, stock-out, or adjustment transactions.

import { Modal, Button, Form, Select, Input, InputNumber, message } from "antd";
import { useTranslation } from "react-i18next";
import { useAdjustStock, useInventoryList } from "../api/index";

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
  const { t } = useTranslation();

  const ADJUSTMENT_TYPE_OPTIONS = [
    { value: "stock_in",  label: t("inventory.stockIn") },
    { value: "stock_out", label: t("inventory.stockOut") },
    { value: "inventory", label: t("inventory.stockCount") },
  ];

  const [form] = Form.useForm<AdjustmentFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const adjustStock = useAdjustStock();
  const { data: inventoryPage, isLoading: inventoryLoading } = useInventoryList({
    maxResultCount: 100,
  });

  const itemOptions = (inventoryPage?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.itemCode}) — ${t("inventory.stock")}: ${item.currentStock} ${item.unit}`,
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
          void messageApi.success(t("inventory.adjustSuccess"));
          form.resetFields();
          onClose();
        },
        onError: () => {
          void messageApi.error(t("inventory.adjustFailed"));
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
      {contextHolder}
      <Modal
        open={open}
        title={t("inventory.adjustStock")}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={adjustStock.isPending}
            style={{ background: "#2671D8" }}
          >
            {t("inventory.saveAdjustment")}
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
              label={t("inventory.material")}
              rules={[{ required: true, message: "Vui lòng chọn vật tư" }]}
            >
              <Select
                showSearch
                placeholder={t("inventory.searchMaterial")}
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
            label={t("inventory.adjustmentType")}
            rules={[{ required: true, message: "Vui lòng chọn loại điều chỉnh" }]}
          >
            <Select
              placeholder={t("inventory.selectAdjustmentType")}
              options={ADJUSTMENT_TYPE_OPTIONS}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={t("inventory.quantity")}
            rules={[
              { required: true, message: "Vui lòng nhập số lượng" },
              { type: "number", min: 1, message: "Số lượng phải lớn hơn 0" },
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
            label={t("inventory.reason")}
            rules={[{ required: true, message: "Vui lòng nhập lý do điều chỉnh" }]}
          >
            <Input.TextArea
              placeholder={t("inventory.reasonPlaceholder")}
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
