import { useEffect } from "react";
import { DatePicker, Form, InputNumber, Modal, message } from "antd";
import dayjs from "dayjs";
import { useReceiveStock, type SupplyDto } from "../api/suppliesApi";
import { extractApiError } from "@/lib/apiError";

interface ReceiveStockModalProps {
  open: boolean;
  supply: SupplyDto | null;
  onClose: () => void;
}

interface ReceiveFormValues {
  quantity: number;
  stockedAt: dayjs.Dayjs;
  expiryDate?: dayjs.Dayjs;
  expiryWarningDays?: number;
}

/**
 * Nhập kho — a receipt carries the expiry of the batch, which is what drives the
 * "Cảnh báo hết hạn" and "Trạng thái" columns.
 */
export function ReceiveStockModal({ open, supply, onClose }: ReceiveStockModalProps) {
  const [form] = Form.useForm<ReceiveFormValues>();
  const receiveStock = useReceiveStock();

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      quantity: undefined,
      stockedAt: dayjs(),
      expiryDate: undefined,
      expiryWarningDays: supply?.expiryWarningDays ?? 30,
    });
  }, [open, supply, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (!supply) return;

    try {
      await receiveStock.mutateAsync({
        id: supply.id,
        input: {
          quantity: values.quantity,
          stockedAt: values.stockedAt.format("YYYY-MM-DD"),
          expiryDate: values.expiryDate?.format("YYYY-MM-DD"),
          expiryWarningDays: values.expiryWarningDays,
        },
      });

      message.success("Đã nhập kho");
      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={supply ? `Nhập kho — ${supply.name}` : "Nhập kho"}
      okText="Nhập kho"
      cancelText="Huỷ"
      confirmLoading={receiveStock.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="quantity"
          label="Số lượng nhập"
          rules={[
            { required: true, message: "Vui lòng nhập số lượng" },
            { type: "number", min: 1, message: "Số lượng phải lớn hơn 0" },
          ]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>

        <Form.Item name="stockedAt" label="Ngày nhập kho" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="expiryDate" label="Hạn sử dụng">
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item
          name="expiryWarningDays"
          label="Cảnh báo trước (ngày)"
          rules={[{ type: "number", min: 0, message: "Không được âm" }]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
