import { Col, DatePicker, Form, Input, InputNumber, Row, Select, TimePicker } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useDentistStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";
import { CLINIC_HOURS_PICKER_PROPS } from "@/utils/clinicHours";
import type { BookInput, TicketDto } from "../api/ticketApi";

interface FormValues {
  date?: Dayjs;
  time?: Dayjs;
  durationMinutes?: number;
  dentistId?: string;
  notes?: string;
}

interface Props {
  ticket: TicketDto | null;
  pending: boolean;
  onSubmit: (input: BookInput) => void;
  onClose: () => void;
}

/** The slot from the date and the start time, as instants — what Lịch hẹn sends too. */
function toSlot(values: FormValues): { slotStart: string; slotEnd: string } {
  const start = values.date!.hour(values.time!.hour()).minute(values.time!.minute()).second(0).millisecond(0);
  return { slotStart: start.toISOString(), slotEnd: start.add(values.durationMinutes ?? 30, "minute").toISOString() };
}

/**
 * Đặt lịch hẹn from a ticket. A lead with a patient record gets a regular
 * appointment, so a dentist is required; a new lead gets a lịch tạm that
 * reception turns into a patient on arrival. Slot and shift rules are Lịch hẹn's.
 */
export function BookAppointmentDialog({ ticket, pending, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const date = Form.useWatch("date", form);
  const { data: dentists = [] } = useDentistStaffOptions(date?.format("YYYY-MM-DD"));
  const needsDentist = Boolean(ticket?.patientId);

  const handleFinish = (values: FormValues) => {
    onSubmit({ ...toSlot(values), dentistId: values.dentistId ?? null, notes: values.notes?.trim() || null });
  };

  return (
    <AppDialog
      open={ticket !== null}
      title={t("Ticket:Book")}
      subtitle={ticket ? `${ticket.fullName} · ${ticket.phone}` : undefined}
      width={560}
      canSave
      saving={pending}
      saveIcon={<CalendarOutlined />}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <p className="mkt-dialog-note">{t(needsDentist ? "Ticket:BookRegularHint" : "Ticket:BookTempHint")}</p>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        preserve={false}
        initialValues={{ date: dayjs(), durationMinutes: 30 }}
        onFinish={handleFinish}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="date" label={t("Ticket:Field:Date")} required rules={[{ required: true, message: t("Ticket:Required:Date") }]}>
              <DatePicker format="DD/MM/YYYY" className="mkt-full" disabledDate={(day) => day.isBefore(dayjs(), "day")} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="time" label={t("Ticket:Field:Time")} required rules={[{ required: true, message: t("Ticket:Required:Time") }]}>
              <TimePicker format="HH:mm" minuteStep={5} className="mkt-full" {...CLINIC_HOURS_PICKER_PROPS} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField
              name="durationMinutes"
              label={t("Ticket:Field:Duration")}
              required
              rules={[{ required: true, type: "number", min: 15, message: t("Ticket:Required:Duration") }]}
            >
              <InputNumber min={15} step={15} className="mkt-full" />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField
              name="dentistId"
              label={t("Ticket:Field:Dentist")}
              required={needsDentist}
              rules={needsDentist ? [{ required: true, message: t("BlueDental:MarketingTicket:0005") }] : []}
            >
              <Select allowClear={!needsDentist} showSearch optionFilterProp="label" options={dentists} />
            </FloatingField>
          </Col>
          <Col span={24}>
            <FloatingField name="notes" label={t("Ticket:Field:Note")}>
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
