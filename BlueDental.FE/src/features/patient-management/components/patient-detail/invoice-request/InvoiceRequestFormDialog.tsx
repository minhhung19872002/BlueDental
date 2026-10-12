import { useEffect, useState } from "react";
import { Form, Select } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  useCreateInvoiceRequest,
  useInvoiceRequestDraft,
  useInvoiceRequestPaymentOptions,
  useUpdateInvoiceRequest,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import { InvoiceRequestFormFields } from "./InvoiceRequestFormFields";
import {
  EMPTY_FORM,
  formRules,
  fromDraft,
  fromRequest,
  toRequestBody,
  type InvoiceRequestFormState,
} from "./invoiceRequestForm";

/** "+ Tạo yêu cầu xuất HĐ" for a receipt of the patient, or Chỉnh sửa on a request filed. */
export type InvoiceRequestFormTarget =
  | { kind: "create"; patientId: string }
  | { kind: "edit"; request: InvoiceRequestDto };

interface Props {
  target: InvoiceRequestFormTarget | null;
  onClose: () => void;
}

export function InvoiceRequestFormDialog({ target, onClose }: Props) {
  const [form] = Form.useForm<InvoiceRequestFormState>();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const creating = target?.kind === "create";
  const options = useInvoiceRequestPaymentOptions(creating ? target.patientId : "", creating);
  const draft = useInvoiceRequestDraft(creating ? paymentId : null);
  const create = useCreateInvoiceRequest();
  const update = useUpdateInvoiceRequest();

  useEffect(() => {
    if (!target) return;
    form.resetFields();
    setPaymentId(null);
    form.setFieldsValue(target.kind === "edit" ? fromRequest(target.request) : EMPTY_FORM);
  }, [target, form]);

  // Picking a receipt fills in what the clinic already knows of the customer.
  useEffect(() => {
    if (draft.data) form.setFieldsValue(fromDraft(draft.data));
  }, [draft.data, form]);

  const picked = options.data?.find((option) => option.patientPaymentId === paymentId);
  const summary = target?.kind === "edit" ? target.request : picked;

  // A refusal is toasted by the global MutationCache; the dialog stays open.
  const handleFinish = (values: InvoiceRequestFormState) => {
    if (!target) return;
    const body = toRequestBody(values);
    const saved = (message: string) => () => {
      toast.success(message);
      onClose();
    };
    if (target.kind === "edit") {
      update.mutate({ id: target.request.id, ...body }, { onSuccess: saved(t("Common:Updated")) });
    } else {
      create.mutate(
        { patientPaymentId: values.patientPaymentId ?? "", ...body },
        { onSuccess: saved(t("Patient:InvoiceRequest:Created")) },
      );
    }
  };

  return (
    <AppDialog
      open={Boolean(target)}
      width={760}
      className="ir-dialog"
      title={t(creating ? "Patient:InvoiceRequest:Create" : "Patient:InvoiceRequest:Edit")}
      subtitle={t("Patient:InvoiceRequest:FormHint")}
      canSave={!creating || Boolean(paymentId)}
      saving={create.isPending || update.isPending}
      cancelLabel={t("Common:CancelAlt")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
        {creating && (
          <FloatingField label={t("Patient:InvoiceRequest:Field:Receipt")} name="patientPaymentId" required rules={formRules().patientPaymentId}>
            <Select
              loading={options.isLoading}
              notFoundContent={t("Patient:InvoiceRequest:NoReceipt")}
              onChange={(value: string) => setPaymentId(value)}
              options={(options.data ?? []).map((option) => ({
                value: option.patientPaymentId,
                label: `${option.paymentCode} · ${formatDate(option.paidAt)} · ${formatMoneyUnit(option.amount)}`,
              }))}
            />
          </FloatingField>
        )}
        {summary && (
          <dl className="ir-summary">
            <div>
              <dt>{t("Patient:InvoiceRequest:Field:Service")}</dt>
              <dd>{summary.serviceName || "—"}</dd>
            </div>
            <div>
              <dt>{t("Patient:InvoiceRequest:Field:Amount")}</dt>
              <dd>{formatMoneyUnit(summary.amount)}</dd>
            </div>
          </dl>
        )}
        <InvoiceRequestFormFields />
      </Form>
    </AppDialog>
  );
}
