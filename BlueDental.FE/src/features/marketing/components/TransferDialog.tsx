import { Form, Select } from "antd";
import { UserSwitchOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { StaffOption } from "../api/ticketSupportApi";

interface Props {
  open: boolean;
  /** Tickets the list's filter matches right now — all of them move. */
  matched: number;
  staffOptions: StaffOption[];
  pending: boolean;
  onSubmit: (assigneeIds: string[]) => void;
  onClose: () => void;
}

interface FormValues {
  assigneeIds?: string[];
}

/**
 * Chuyển ticket hàng loạt (BA 8.3): every ticket under the current filter goes
 * to the chosen staff. With several chosen, the server deals them out in turn,
 * which is how a group shares a batch.
 */
export function TransferDialog({ open, matched, staffOptions, pending, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();

  return (
    <AppDialog
      open={open}
      title={t("Ticket:TransferTitle")}
      subtitle={t("Ticket:TransferSubtitle", matched)}
      width={520}
      canSave={matched > 0}
      saving={pending}
      saveLabel={t("Ticket:Transfer")}
      saveIcon={<UserSwitchOutlined />}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={(values) => onSubmit(values.assigneeIds ?? [])}>
        <FloatingField
          name="assigneeIds"
          label={t("Ticket:TransferTo")}
          extra={t("Ticket:TransferHint")}
          rules={[{ required: true, type: "array", min: 1, message: t("Ticket:TransferRequired") }]}
        >
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={staffOptions} />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
