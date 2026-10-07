import type { CSSProperties } from "react";
import { Form, Input, InputNumber } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { TicketTagDto, TicketTagInput } from "../api/ticketSupportApi";
import { TAG_COLORS } from "./ticketConfig";
import { TagChip } from "./TicketTagChips";

interface FormValues {
  name: string;
  color: string;
  maxProcessingDays?: number | null;
}

interface Props {
  open: boolean;
  /** The tag being edited; null opens an empty Thêm thẻ form. */
  tag: TicketTagDto | null;
  saving: boolean;
  onSubmit: (input: TicketTagInput) => void;
  onClose: () => void;
}

function initialValues(tag: TicketTagDto | null): FormValues {
  return tag
    ? { name: tag.name, color: tag.color, maxProcessingDays: tag.maxProcessingDays ?? null }
    : { name: "", color: TAG_COLORS[0], maxProcessingDays: null };
}

interface SwatchProps {
  value?: string;
  onChange?: (color: string) => void;
}

/** The fixed palette — a tag's colour has to read on a white table row, so it is picked, not typed. */
function ColorSwatches({ value, onChange }: SwatchProps) {
  return (
    <div className="mkt-swatches" role="radiogroup" aria-label={t("Ticket:Tag:Color")}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className={value === color ? "mkt-swatch mkt-swatch--active" : "mkt-swatch"}
          style={{ "--mkt-tag-color": color } as CSSProperties}
          onClick={() => onChange?.(color)}
        />
      ))}
    </div>
  );
}

/**
 * Thêm / Sửa thẻ ticket. Thời gian xử lý is the deadline a ticket with this tag
 * gets from its Ngày nhận; changing it later does not move tickets already tagged.
 */
export function TagDialog({ open, tag, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form);
  const color = Form.useWatch("color", form);

  const handleFinish = (values: FormValues) => {
    onSubmit({ name: values.name.trim(), color: values.color, maxProcessingDays: values.maxProcessingDays ?? null });
  };

  return (
    <AppDialog
      open={open}
      title={t(tag ? "Ticket:Tag:Edit" : "Ticket:Tag:Create")}
      width={460}
      canSave
      saving={saving}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} initialValues={initialValues(tag)} onFinish={handleFinish}>
        <FloatingField
          name="name"
          label={t("Ticket:Tag:Name")}
          required
          rules={[{ required: true, whitespace: true, message: t("Ticket:Required:TagName") }]}
        >
          <Input maxLength={100} autoFocus />
        </FloatingField>
        <FloatingField
          name="maxProcessingDays"
          label={t("Ticket:Tag:ProcessingDays")}
          extra={t("Ticket:Tag:ProcessingDaysHint")}
          rules={[{ type: "number", min: 1, max: 365, message: t("Ticket:Tag:ProcessingDaysRange") }]}
        >
          <InputNumber min={1} max={365} precision={0} className="mkt-full" suffix={t("Ticket:Days")} />
        </FloatingField>
        <Form.Item name="color" label={t("Ticket:Tag:Color")} rules={[{ required: true }]}>
          <ColorSwatches />
        </Form.Item>
        {name?.trim() && color && (
          <div className="mkt-tag-preview">
            {t("Ticket:Tag:Preview")}: <TagChip tag={{ name: name.trim(), color }} />
          </div>
        )}
      </Form>
    </AppDialog>
  );
}
