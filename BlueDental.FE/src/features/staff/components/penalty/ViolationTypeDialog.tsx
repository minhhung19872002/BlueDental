import { useState } from "react";
import { Button, Form, Input, Table, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { Ability } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useStaffViolationTypeCommands, type StaffViolationTypeDto } from "../../api/staffPenaltyApi";

interface FormValues {
  name: string;
  defaultFineAmount?: number;
}

interface Props {
  open: boolean;
  types: StaffViolationTypeDto[];
  ability: Ability;
  onClose: () => void;
}

/** Loại vi phạm of the branch: add or rename at the top, the list below. */
export function ViolationTypeDialog({ open, types, ability, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<StaffViolationTypeDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffViolationTypeDto | null>(null);
  const commands = useStaffViolationTypeCommands();
  const canWrite = editing ? ability.canUpdate : ability.canCreate;

  const startEdit = (type: StaffViolationTypeDto) => {
    setEditing(type);
    form.setFieldsValue({ name: type.name, defaultFineAmount: type.defaultFineAmount || undefined });
  };

  const resetForm = () => {
    setEditing(null);
    form.resetFields();
  };

  const handleFinish = async (values: FormValues) => {
    const input = { name: values.name.trim(), defaultFineAmount: values.defaultFineAmount ?? 0 };
    try {
      if (editing) await commands.update.mutateAsync({ id: editing.id, input });
      else await commands.create.mutateAsync(input);
      toast.success(t("StaffViolationType:Saved"));
      resetForm();
    } catch {
      // queryClient reports the failure; the values stay to retry.
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await commands.remove.mutateAsync(pendingDelete.id);
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure.
    }
  };

  const columns = [
    { title: t("StaffViolationType:Name"), dataIndex: "name" },
    {
      title: t("StaffViolationType:DefaultFine"),
      dataIndex: "defaultFineAmount",
      width: 180,
      align: "right" as const,
      render: (value: number) => (value > 0 ? `${formatVND(value)} đ` : "—"),
    },
    {
      key: "actions",
      width: 90,
      render: (_: unknown, type: StaffViolationTypeDto) => (
        <div className="staff-penalty-actions">
          {ability.canUpdate && (
            <Tooltip title={t("Common:Edit")}>
              <Button type="text" size="small" aria-label={t("Common:Edit")} icon={<EditOutlined />} onClick={() => startEdit(type)} />
            </Tooltip>
          )}
          {ability.canDelete && (
            <Tooltip title={t("Common:Delete")}>
              <Button type="text" size="small" danger aria-label={t("Common:Delete")} icon={<DeleteOutlined />} onClick={() => setPendingDelete(type)} />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppDialog
      open={open}
      title={t("StaffViolationType:Title")}
      width={640}
      canSave={canWrite}
      saving={commands.create.isPending || commands.update.isPending}
      saveLabel={editing ? t("Common:Save") : t("StaffViolationType:Add")}
      saveIcon={editing ? <SaveOutlined /> : <PlusOutlined />}
      footerActions={editing ? <Button onClick={resetForm}>{t("Common:Cancel")}</Button> : null}
      onSave={() => form.submit()}
      onClose={() => { resetForm(); onClose(); }}
    >
      <Form form={form} layout="vertical" className="staff-violation-types__add" onFinish={(v) => void handleFinish(v)}>
        <Form.Item name="name" label={t("StaffViolationType:Name")} rules={[{ required: true, whitespace: true, message: t("StaffViolationType:Required:Name") }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="defaultFineAmount" label={t("StaffViolationType:DefaultFine")}>
          <CurrencyInput />
        </Form.Item>
      </Form>
      <Table<StaffViolationTypeDto>
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={types}
        pagination={false}
        locale={{ emptyText: t("StaffViolationType:Empty") }}
      />
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("StaffViolationType:Noun")}
        name={pendingDelete?.name ?? ""}
        pending={commands.remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </AppDialog>
  );
}
