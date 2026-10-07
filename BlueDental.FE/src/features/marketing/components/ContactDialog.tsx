import { DatePicker, Form, Input, Radio } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { CONTACT_RESULT, type ContactInput, type ContactResult } from "../api/ticketApi";
import { contactResultOptions } from "./ticketConfig";

interface FormValues {
  result?: ContactResult;
  note?: string;
  nextCallAt?: Dayjs;
}

interface Props {
  open: boolean;
  /** "Name · phone", shown under the title so the caller knows who they are logging. */
  subtitle: string;
  pending: boolean;
  onSubmit: (input: ContactInput) => void;
  onClose: () => void;
}

/** A call-back time already passed is refused by the server (Marketing:0003); say so before saving. */
const validateFuture = (_: unknown, value?: Dayjs) =>
  !value || value.isAfter(dayjs())
    ? Promise.resolve()
    : Promise.reject(new Error(t("BlueDental:MarketingTicket:0003")));

/**
 * Ghi nhận chăm sóc: one call or message and how it went. The first one takes
 * a Mới ticket to Đang chăm sóc; "Gọi lại sau" needs a time to call back.
 */
export function ContactDialog({ open, subtitle, pending, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const result = Form.useWatch("result", form);
  const isCallBack = result === CONTACT_RESULT.CallBack;

  const handleFinish = (values: FormValues) => {
    onSubmit({
      result: values.result!,
      note: values.note?.trim() || null,
      nextCallAt: values.result === CONTACT_RESULT.CallBack ? values.nextCallAt?.toISOString() ?? null : null,
    });
  };

  return (
    <AppDialog
      open={open}
      title={t("Ticket:LogContact")}
      subtitle={subtitle}
      width={520}
      canSave
      saving={pending}
      saveIcon={<PhoneOutlined />}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={handleFinish}>
        <Form.Item name="result" label={t("Ticket:Field:Result")} rules={[{ required: true, message: t("Ticket:Required:Result") }]}>
          <Radio.Group className="mkt-result-options" options={contactResultOptions()} />
        </Form.Item>
        {isCallBack && (
          <FloatingField
            name="nextCallAt"
            label={t("Ticket:Field:NextCall")}
            required
            rules={[
              { required: true, message: t("BlueDental:MarketingTicket:0003") },
              { validator: validateFuture },
            ]}
          >
            <DatePicker
              showTime={{ format: "HH:mm", minuteStep: 5 }}
              format="DD/MM/YYYY HH:mm"
              className="mkt-full"
              disabledDate={(day) => day.isBefore(dayjs(), "day")}
            />
          </FloatingField>
        )}
        <FloatingField name="note" label={t("Ticket:Field:ContactNote")}>
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
