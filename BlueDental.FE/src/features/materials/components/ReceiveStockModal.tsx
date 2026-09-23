import { useEffect } from "react";
import { DatePicker, Form, InputNumber, Modal } from "antd";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useReceiveStock, type SupplyDto } from "../api/suppliesApi";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";

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

      toast.success(t("Materials:StockReceived"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={supply ? t("Materials:ReceiveStockTitle", supply.name) : t("Materials:ReceiveStockTitleSimple")}
      okText={t("Materials:ReceiveOkText")}
      cancelText={t("Materials:ReceiveCancelText")}
      confirmLoading={receiveStock.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="quantity"
          label={t("Materials:ReceiveQtyLabel")}
          rules={[
            { required: true, message: t("Materials:ReceiveQtyRequired") },
            { type: "number", min: 1, message: t("Materials:ReceiveQtyMin") },
          ]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>

        <Form.Item name="stockedAt" label={t("Materials:ReceiveStockedAtLabel")} rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="expiryDate" label={t("Materials:ReceiveExpiryLabel")}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item
          name="expiryWarningDays"
          label={t("Materials:ReceiveWarningLabel")}
          rules={[{ type: "number", min: 0, message: t("Materials:NotNegative") }]}
        >
          <InputNumber<number> style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
