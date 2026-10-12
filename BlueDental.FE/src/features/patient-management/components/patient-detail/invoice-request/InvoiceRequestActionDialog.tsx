import { useEffect } from "react";
import { Form, Input } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import {
  useCancelInvoiceRequest,
  useCompleteInvoiceRequest,
  useNeedsInfoInvoiceRequest,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";

export type InvoiceRequestActionKind = "needs-info" | "complete" | "cancel";

export interface InvoiceRequestAction {
  kind: InvoiceRequestActionKind;
  request: InvoiceRequestDto;
}

/** Title, field, its error and the toast of each action that asks for one line of text. */
const ACTION_TEXT: Record<
  InvoiceRequestActionKind,
  { title: string; field: string; required: string; done: string; save: string }
> = {
  "needs-info": {
    title: "Patient:InvoiceRequest:Action:NeedsInfo",
    field: "Patient:InvoiceRequest:Field:NeedsInfoReason",
    required: "BlueDental:InvoiceRequest:0010",
    done: "Patient:InvoiceRequest:Done:NeedsInfo",
    save: "Patient:InvoiceRequest:Action:NeedsInfo",
  },
  complete: {
    title: "Patient:InvoiceRequest:Action:Complete",
    field: "Patient:InvoiceRequest:Field:InvoiceNo",
    required: "BlueDental:InvoiceRequest:0011",
    done: "Patient:InvoiceRequest:Done:Complete",
    save: "Patient:InvoiceRequest:Action:Complete",
  },
  cancel: {
    title: "Patient:InvoiceRequest:Action:Cancel",
    field: "Patient:InvoiceRequest:Field:CancelReason",
    required: "BlueDental:InvoiceRequest:0010",
    done: "Patient:InvoiceRequest:Done:Cancel",
    save: "Patient:InvoiceRequest:Action:Cancel",
  },
};

interface Props {
  action: InvoiceRequestAction | null;
  onClose: () => void;
  /** The request as the server left it, so an open detail dialog can follow. */
  onDone: (updated: InvoiceRequestDto) => void;
}

/** Cần bổ sung and Hủy take a reason, Hoàn tất takes the invoice number. */
export function InvoiceRequestActionDialog({ action, onClose, onDone }: Props) {
  const [form] = Form.useForm<{ text: string }>();
  const text = Form.useWatch("text", form) ?? "";
  const needsInfo = useNeedsInfoInvoiceRequest();
  const complete = useCompleteInvoiceRequest();
  const cancel = useCancelInvoiceRequest();
  const copy = ACTION_TEXT[action?.kind ?? "needs-info"];

  useEffect(() => {
    if (action) form.setFieldsValue({ text: "" });
  }, [action, form]);

  const handleFinish = ({ text: value }: { text: string }) => {
    if (!action) return;
    const id = action.request.id;
    const done = {
      onSuccess: (updated: InvoiceRequestDto) => {
        toast.success(t(copy.done));
        onDone(updated);
      },
    };
    if (action.kind === "complete") complete.mutate({ id, invoiceNo: value.trim() }, done);
    else if (action.kind === "cancel") cancel.mutate({ id, reason: value.trim() }, done);
    else needsInfo.mutate({ id, reason: value.trim() }, done);
  };

  return (
    <AppDialog
      open={Boolean(action)}
      width={480}
      title={`${t(copy.title)} · ${action?.request.code ?? ""}`}
      canSave={text.trim().length > 0}
      saving={needsInfo.isPending || complete.isPending || cancel.isPending}
      saveLabel={t(copy.save)}
      saveIcon={null}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
        <FloatingField
          label={t(copy.field)}
          name="text"
          required
          rules={[{ required: true, whitespace: true, message: t(copy.required) }]}
        >
          {action?.kind === "complete" ? (
            <Input maxLength={50} autoFocus />
          ) : (
            <Input.TextArea maxLength={500} rows={3} autoFocus />
          )}
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
