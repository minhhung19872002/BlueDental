import { Col, Form, Row, Select, type FormInstance } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { TicketFileHeaders, TicketImportOptions } from "../api/ticketFileApi";
import type { StaffOption, TicketTagDto } from "../api/ticketSupportApi";
import type { useSourceOptions } from "../hooks/useSourceOptions";
import { TagChip } from "./TicketTagChips";

export interface TicketImportValues {
  fullName?: number;
  phone?: number;
  email?: number;
  note?: number;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  tagIds?: string[];
  assigneeIds?: string[];
}

interface Props {
  form: FormInstance<TicketImportValues>;
  headers: TicketFileHeaders;
  tags: TicketTagDto[];
  sources: ReturnType<typeof useSourceOptions>;
  /** Absent without the transfer leaf — the server refuses assignees then, and the tickets go to the pool. */
  staffOptions?: StaffOption[];
  onSubmit: (options: TicketImportOptions) => void;
}

const FIELDS = [
  { name: "fullName", label: "Ticket:Import:Col:FullName", required: "Ticket:Import:Required:FullName" },
  { name: "phone", label: "Ticket:Import:Col:Phone", required: "Ticket:Import:Required:Phone" },
  { name: "email", label: "Ticket:Import:Col:Email" },
  { name: "note", label: "Ticket:Import:Col:Note" },
] as const;

/** Excel's own name for a 1-based column: 1 → A, 27 → AA. */
function columnLetter(column: number): string {
  let letter = "";
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
}

/**
 * Ghép cột: which column of the file is which ticket field — so a clinic's own
 * export imports as well as the template ("template tùy chọn") — and the Nguồn,
 * Thẻ and staff every ticket of the file gets ("chia dữ liệu cho nhóm hoặc cho
 * nhân viên").
 */
export function TicketImportMapping({ form, headers, tags, sources, staffOptions, onSubmit }: Props) {
  const groupId = Form.useWatch("sourceTaxonomyId", form);
  const columnOptions = headers.headers.map((header, index) => {
    const name = t("Ticket:Import:ColumnN", columnLetter(index + 1));
    return { value: index + 1, label: header ? `${name} · ${header}` : name };
  });
  const tagOptions = tags.map((tag) => ({ value: tag.id, label: <TagChip tag={tag} />, title: tag.name }));

  const handleFinish = (values: TicketImportValues) =>
    onSubmit({
      mapping: { fullName: values.fullName, phone: values.phone, email: values.email, note: values.note },
      sourceTaxonomyId: values.sourceTaxonomyId,
      sourceEntryId: values.sourceEntryId,
      tagIds: values.tagIds ?? [],
      assigneeIds: values.assigneeIds ?? [],
    });

  return (
    <Form form={form} layout="vertical" requiredMark={false} initialValues={headers.suggested} onFinish={handleFinish} preserve={false}>
      <h3 className="mkt-section-title">{t("Ticket:Import:Columns")}</h3>
      <Row gutter={12}>
        {FIELDS.map((field) => (
          <Col key={field.name} xs={24} md={12}>
            <FloatingField
              name={field.name}
              label={t(field.label)}
              required={"required" in field}
              rules={"required" in field ? [{ required: true, message: t(field.required) }] : undefined}
            >
              <Select allowClear showSearch optionFilterProp="label" options={columnOptions} />
            </FloatingField>
          </Col>
        ))}
      </Row>

      <h3 className="mkt-section-title">{t("Ticket:Import:ShareOut")}</h3>
      <Row gutter={12}>
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
            <Select allowClear showSearch optionFilterProp="label" options={sources.channelsOf(groupId)} disabled={!groupId} />
          </FloatingField>
        </Col>
        <Col span={24}>
          <FloatingField name="tagIds" label={t("Ticket:Field:Tags")}>
            <Select mode="multiple" allowClear optionFilterProp="title" options={tagOptions} />
          </FloatingField>
        </Col>
        {staffOptions && (
          <Col span={24}>
            <FloatingField name="assigneeIds" label={t("Ticket:File:Col:Assignees")} extra={t("Ticket:Import:AssigneesHint")}>
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={staffOptions} />
            </FloatingField>
          </Col>
        )}
      </Row>
    </Form>
  );
}
