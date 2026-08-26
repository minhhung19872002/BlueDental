import { Col, Form, Input, Row } from "antd";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  useCreateDepartment,
  useUpdateDepartment,
  type DepartmentDto,
} from "../api/departmentApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  sortOrder: string;
}

interface Props {
  open: boolean;
  /** null creates a department, otherwise edits this one. */
  department: DepartmentDto | null;
  onClose: () => void;
  onCreated: (department: DepartmentDto) => void;
}

/**
 * "Tạo phòng ban" — a name and a position, as the reference asks for them.
 *
 * The position is kept with the department's description for now: BlueDental's
 * Department carries no order column of its own, and adding one is a schema
 * change this screen does not need to make on its own.
 */
export function DepartmentDialog({ open, department, onClose, onCreated }: Props) {
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: department?.name ?? "",
      sortOrder: department?.description ?? "",
    });
  }, [open, department, form]);

  const submit = async (values: FormValues) => {
    const input = {
      name: values.name.trim(),
      description: values.sortOrder.trim() || undefined,
    };

    try {
      if (department) {
        await updateDepartment.mutateAsync({ id: department.id, data: input });
        toast.success(t("Đã cập nhật phòng ban"));
        onClose();
        return;
      }

      const created = await createDepartment.mutateAsync(input);
      toast.success(t("Đã thêm phòng ban"));
      onClose();
      onCreated(created);
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={department ? t("Sửa phòng ban") : t("Tạo phòng ban")}
      canSave={name.trim().length > 0}
      saving={createDepartment.isPending || updateDepartment.isPending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="name"
              label={t("Tên phòng ban")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên phòng ban") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="sortOrder" label={t("Số thứ tự")}>
              <Input inputMode="numeric" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
