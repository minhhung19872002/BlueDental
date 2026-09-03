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
    { value: "stock_in",  label: t("Nhập kho") },
    { value: "stock_out", label: t("Xuất kho") },
    { value: "inventory", label: t("Kiểm kê") },
  ];

  const [form] = Form.useForm<AdjustmentFormValues>();

  const adjustStock = useAdjustStock();
  const { data: inventoryPage, isLoading: inventoryLoading } = useInventoryList({
    maxResultCount: 100,
  });

  const itemOptions = (inventoryPage?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.itemCode}) — ${t("tồn")}: ${item.currentStock} ${item.unit}`,
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
          toast.success(t("Điều chỉnh kho thành công!"));
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
        title={t("Điều chỉnh kho")}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t("Hủy")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={adjustStock.isPending}
            style={{ background: "var(--bd-blue)" }}
          >
            {t("Lưu điều chỉnh")}
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
              label={t("Vật tư")}
              rules={[{ required: true, message: t("Vui lòng chọn vật tư") }]}
            >
              <Select
                showSearch
                placeholder={t("Tìm và chọn vật tư...")}
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
            label={t("Loại điều chỉnh")}
            rules={[{ required: true, message: t("Vui lòng chọn loại điều chỉnh") }]}
          >
            <Select
              placeholder={t("Chọn loại điều chỉnh")}
              options={ADJUSTMENT_TYPE_OPTIONS}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={t("Số lượng")}
            rules={[
              { required: true, message: t("Vui lòng nhập số lượng") },
              { type: "number", min: 1, message: t("Số lượng phải lớn hơn 0") },
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
            label={t("Lý do")}
            rules={[{ required: true, message: t("Vui lòng nhập lý do") }]}
          >
            <Input.TextArea
              placeholder={t("Nhập lý do điều chỉnh...")}
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
