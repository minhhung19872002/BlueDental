import { useEffect } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Typography,
} from "antd";
import { useInvoice, useRecordPayment, type RecordPaymentRequest } from "../api";

const { Text } = Typography;

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "Cash",     label: "Tiền mặt" },
  { value: "Transfer", label: "Chuyển khoản" },
  { value: "Card",     label: "Thẻ" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
}

interface FormValues {
  amount: number;
  paymentMethod: string;
  note?: string;
}

export function PaymentModal({ open, onClose, invoiceId }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { mutate: recordPayment, isPending } = useRecordPayment();

  const balance = invoice ? invoice.totalAmount - invoice.paidAmount : 0;

  // Pre-fill amount with remaining balance whenever modal opens or invoice changes
  useEffect(() => {
    if (open && balance > 0) {
      form.setFieldValue("amount", balance);
    }
  }, [open, balance, form]);

  function handleClose(): void {
    form.resetFields();
    onClose();
  }

  function handleSubmit(values: FormValues): void {
    const payload: RecordPaymentRequest = {
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      note: values.note,
    };
    recordPayment(
      { id: invoiceId, data: payload },
      {
        onSuccess: () => {
          messageApi.success("Ghi nhận thanh toán thành công.");
          handleClose();
        },
        onError: () => {
          messageApi.error("Ghi nhận thanh toán thất bại. Vui lòng thử lại.");
        },
      }
    );
  }

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title="Ghi nhận thanh toán"
        onCancel={handleClose}
        footer={null}
        destroyOnClose
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <>
            {invoice && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Còn lại cần thanh toán: </Text>
                <Text strong type={balance > 0 ? "danger" : "success"}>
                  {formatCurrency(balance)}
                </Text>
              </div>
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ paymentMethod: "Cash" }}
            >
              <Form.Item
                name="amount"
                label="Số tiền thanh toán"
                rules={[
                  { required: true, message: "Vui lòng nhập số tiền." },
                  {
                    type: "number",
                    min: 1,
                    message: "Số tiền phải lớn hơn 0.",
                  },
                  {
                    validator: (_, value: number) => {
                      if (value > balance) {
                        return Promise.reject(
                          new Error("Số tiền không được vượt quá số dư còn lại.")
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  step={1000}
                  formatter={(val) =>
                    val ? `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                  }
                  parser={(val) => Number((val ?? "").replace(/,/g, ""))}
                  addonAfter="₫"
                />
              </Form.Item>

              <Form.Item
                name="paymentMethod"
                label="Phương thức thanh toán"
                rules={[{ required: true, message: "Vui lòng chọn phương thức." }]}
              >
                <Select options={PAYMENT_METHODS} />
              </Form.Item>

              <Form.Item name="note" label="Ghi chú (tuỳ chọn)">
                <Input.TextArea rows={3} placeholder="Nhập ghi chú nếu cần..." />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                <Button style={{ marginRight: 8 }} onClick={handleClose}>
                  Huỷ
                </Button>
                <Button type="primary" htmlType="submit" loading={isPending}>
                  Xác nhận thanh toán
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
}
