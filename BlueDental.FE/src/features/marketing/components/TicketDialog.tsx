import { Col, Form, Input, Row, Select } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { CreateTicketInput, TicketDto } from "../api/ticketApi";
import type { StaffOption, TicketTagDto } from "../api/ticketSupportApi";
import type { useSourceOptions } from "../hooks/useSourceOptions";
import { isValidTicketPhone } from "./ticketConfig";
import { TagChip } from "./TicketTagChips";

interface FormValues {
  fullName?: string;
  phone?: string;
  email?: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  tagIds?: string[];
  assigneeId?: string;
  note?: string;
}

interface Props {
  open: boolean;
  /** The ticket being edited; null opens an empty Tạo ticket form. */
  ticket: TicketDto | null;
  tags: TicketTagDto[];
  sources: ReturnType<typeof useSourceOptions>;
  /** Present when the account may hand a new ticket to someone (marketingTicket.transfer). */
  staffOptions?: StaffOption[];
  saving: boolean;
  onSubmit: (input: CreateTicketInput) => void;
  onClose: () => void;
}

/** Empty is the required rule's to report. */
const validatePhone = (_: unknown, value?: string) =>
  !value?.trim() || isValidTicketPhone(value)
    ? Promise.resolve()
    : Promise.reject(new Error(t("BlueDental:MarketingTicket:0001")));

function initialValues(ticket: TicketDto | null): FormValues {
  if (!ticket) return { tagIds: [] };
  return {
    fullName: ticket.fullName,
    phone: ticket.phone,
    email: ticket.email ?? undefined,
    sourceTaxonomyId: ticket.sourceTaxonomyId ?? undefined,
    sourceEntryId: ticket.sourceEntryId ?? undefined,
    tagIds: ticket.tagIds,
    note: ticket.note ?? undefined,
  };
}

const blankToNull = (value?: string) => value?.trim() || null;

/** Tạo / Sửa ticket. The same phone on an open ticket is not a new lead — the server says so after save. */
export function TicketDialog({ open, ticket, tags, sources, staffOptions, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const groupId = Form.useWatch("sourceTaxonomyId", form);

  const handleFinish = (values: FormValues) => {
    onSubmit({
      fullName: values.fullName!.trim(),
      phone: values.phone!.trim(),
      email: blankToNull(values.email),
      note: blankToNull(values.note),
      sourceTaxonomyId: values.sourceTaxonomyId ?? null,
      sourceEntryId: values.sourceEntryId ?? null,
      tagIds: values.tagIds ?? [],
      assigneeId: values.assigneeId ?? null,
    });
  };

  const tagOptions = tags.map((tag) => ({ value: tag.id, label: <TagChip tag={tag} />, title: tag.name }));

  return (
    <AppDialog
      open={open}
      title={t(ticket ? "Ticket:DialogEdit" : "Ticket:DialogCreate")}
      subtitle={ticket?.code}
      width={680}
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues(ticket)} onFinish={handleFinish} preserve={false}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField
              name="fullName"
              label={t("Ticket:Field:FullName")}
              required
              rules={[{ required: true, whitespace: true, message: t("Ticket:Required:FullName") }]}
            >
              <Input maxLength={200} autoFocus />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField
              name="phone"
              label={t("Ticket:Field:Phone")}
              required
              rules={[{ required: true, whitespace: true, message: t("Ticket:Required:Phone") }, { validator: validatePhone }]}
            >
              <Input maxLength={30} inputMode="tel" />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="email" label={t("Ticket:Field:Email")} rules={[{ type: "email", message: t("Ticket:Invalid:Email") }]}>
              <Input maxLength={256} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="tagIds" label={t("Ticket:Field:Tags")}>
              <Select mode="multiple" allowClear optionFilterProp="title" options={tagOptions} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="sourceTaxonomyId" label={t("Ticket:Field:Source")}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={sources.groupOptions}
                onChange={() => form.setFieldValue("sourceEntryId", undefined)}
              />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="sourceEntryId" label={t("Ticket:Field:Channel")}>
              <Select allowClear showSearch optionFilterProp="label" disabled={!groupId} options={sources.channelsOf(groupId)} />
            </FloatingField>
          </Col>
          {!ticket && staffOptions && (
            <Col span={24}>
              <FloatingField name="assigneeId" label={t("Ticket:Field:Assignee")} extra={t("Ticket:AssigneeHint")} alwaysFloat>
                <Select allowClear showSearch optionFilterProp="label" options={staffOptions} placeholder={t("Ticket:Pool")} />
              </FloatingField>
            </Col>
          )}
          <Col span={24}>
            <FloatingField name="note" label={t("Ticket:Field:Note")}>
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
