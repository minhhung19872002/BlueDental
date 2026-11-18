import { useEffect } from "react";
import { Form, Input } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { useWithdrawInvoiceRequest, type InvoiceRequestDto } from "../../../api/invoiceRequestApi";

interface Props {
  /** The request to withdraw; null keeps the dialog shut. */
  request: InvoiceRequestDto | null;
  onClose: () => void;
  /** The request as the server left it, so an open detail dialog can follow. */
  onDone: (updated: InvoiceRequestDto) => void;
}

/** Hủy yêu cầu: closes the request for good, with the reason why. */
export function InvoiceRequestWithdrawDialog({ request, onClose, onDone }: Props) {
  const [form] = Form.useForm<{ reason: string }>();
  const reason = Form.useWatch("reason", form) ?? "";
  const withdraw = useWithdrawInvoiceRequest();

  useEffect(() => {
    if (request) form.setFieldsValue({ reason: "" });
  }, [request, form]);

  const handleFinish = ({ reason: value }: { reason: string }) => {
    if (!request) return;
    withdraw.mutate(
      { id: request.id, reason: value.trim() },
      {
        onSuccess: (updated) => {
          toast.success(t("Patient:InvoiceRequest:Done:Withdraw"));
          onDone(updated);
        },
      },
    );
  };

  return (
    <AppDialog
      open={Boolean(request)}
      width={480}
      title={`${t("Patient:InvoiceRequest:Action:Withdraw")} · ${request?.code ?? ""}`}
      canSave={reason.trim().length > 0}
      saving={withdraw.isPending}
      saveLabel={t("Patient:InvoiceRequest:Action:Withdraw")}
      saveIcon={null}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
        <FloatingField
          label={t("Patient:InvoiceRequest:Field:WithdrawReason")}
          name="reason"
          required
          rules={[{ required: true, whitespace: true, message: t("BlueDental:InvoiceRequest:0010") }]}
        >
          <Input.TextArea maxLength={500} rows={3} autoFocus />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
