import type { ReactNode } from "react";
import { Form, Input } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  title: string;
  subtitle: string;
  label: string;
  /** Shown above the box — what the action does. */
  note?: string;
  confirmLabel: string;
  confirmIcon: ReactNode;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** An action that must say why — Không tiềm năng, Xoá ticket. The server refuses a blank reason too. */
export function ReasonDialog({ open, title, subtitle, label, note, confirmLabel, confirmIcon, pending, onConfirm, onClose }: Props) {
  const [form] = Form.useForm<{ reason: string }>();

  return (
    <AppDialog
      open={open}
      title={title}
      subtitle={subtitle}
      width={460}
      canSave
      saving={pending}
      saveLabel={confirmLabel}
      saveIcon={confirmIcon}
      cancelLabel={t("Common:Close")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {note && <p className="mkt-dialog-note">{note}</p>}
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={(values) => onConfirm(values.reason.trim())}>
        <FloatingField name="reason" label={label} required rules={[{ required: true, whitespace: true, message: t("Ticket:Required:Reason") }]}>
          <Input.TextArea rows={4} maxLength={500} showCount autoFocus />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
