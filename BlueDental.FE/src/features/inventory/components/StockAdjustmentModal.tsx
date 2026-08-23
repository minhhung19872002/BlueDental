// StockAdjustmentModal — records stock-in, stock-out, or adjustment transactions.

import { Modal, Button, Form, Select, Input, InputNumber, message } from "antd";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface AdjustmentFormValues {
  adjustmentType: "stock_in" | "stock_out" | "inventory";
  materialName: string;
  quantity: number;
  reason: string;
}

const ADJUSTMENT_TYPE_OPTIONS = [
  { value: "stock_in", label: "Nhập kho" },
  { value: "stock_out", label: "Xuất kho" },
  { value: "inventory", label: "Kiểm kê" },
];

export function StockAdjustmentModal({ open, onClose }: Props) {
  const [form] = Form.useForm<AdjustmentFormValues>();

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      message.success("Điều chỉnh kho thành công!");
      form.resetFields();
      onClose();
    } catch {
      // validation errors are shown inline
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Điều chỉnh kho"
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Hủy
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} style={{ background: "#2671D8" }}>
          Lưu điều chỉnh
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
        <Form.Item
          name="adjustmentType"
          label="Loại điều chỉnh"
          rules={[{ required: true, message: "Vui lòng chọn loại điều chỉnh" }]}
        >
          <Select
            placeholder="Chọn loại điều chỉnh"
            options={ADJUSTMENT_TYPE_OPTIONS}
          />
        </Form.Item>

        <Form.Item
          name="materialName"
          label="Vật tư"
          rules={[{ required: true, message: "Vui lòng nhập tên vật tư" }]}
        >
          <Input placeholder="Tên vật tư" />
        </Form.Item>

        <Form.Item
          name="quantity"
          label="Số lượng"
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
          label="Lý do"
          rules={[{ required: true, message: "Vui lòng nhập lý do điều chỉnh" }]}
        >
          <Input.TextArea
            placeholder="Nhập lý do điều chỉnh..."
            rows={3}
            showCount
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
