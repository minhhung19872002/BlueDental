import { Form, Select } from "antd";
import { UserSwitchOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import type { StaffOption } from "../api/ticketSupportApi";

interface Props {
  open: boolean;
  subtitle: string;
  currentAssigneeId: string | null;
  /** Shown for the current assignee when they are not on the branch's staff list (e.g. an admin who claimed it). */
  currentAssigneeName: string | null;
  staffOptions: StaffOption[];
  pending: boolean;
  /** Null sends the ticket back to the pool. */
  onSubmit: (assigneeId: string | null) => void;
  onClose: () => void;
}

/** The staff list, with the current assignee pinned on top when it lacks them — else the box shows a raw id. */
function withCurrent(options: StaffOption[], id: string | null, name: string | null): StaffOption[] {
  if (!id || options.some((option) => option.value === id)) return options;
  return [{ value: id, label: name ?? id }, ...options];
}

/** Phân công: hand the ticket to someone at its branch, or clear the box to return it to the pool. */
export function AssignDialog(props: Props) {
  const { open, subtitle, currentAssigneeId, staffOptions, pending, onSubmit, onClose } = props;
  const [form] = Form.useForm<{ assigneeId?: string }>();
  const options = withCurrent(staffOptions, currentAssigneeId, props.currentAssigneeName);

  /** Keeping the same person is not a transfer; just close. */
  const handleFinish = ({ assigneeId }: { assigneeId?: string }) => {
    if ((assigneeId ?? null) === currentAssigneeId) onClose();
    else onSubmit(assigneeId ?? null);
  };

  return (
    <AppDialog
      open={open}
      title={t("Ticket:Assign")}
      subtitle={subtitle}
      width={460}
      canSave
      saving={pending}
      saveIcon={<UserSwitchOutlined />}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        preserve={false}
        initialValues={{ assigneeId: currentAssigneeId ?? undefined }}
        onFinish={handleFinish}
      >
        <FloatingField name="assigneeId" label={t("Ticket:Field:Assignee")} extra={t("Ticket:AssignPoolHint")} alwaysFloat>
          <Select allowClear showSearch optionFilterProp="label" options={options} placeholder={t("Ticket:Pool")} />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
