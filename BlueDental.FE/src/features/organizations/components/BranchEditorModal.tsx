import { useEffect } from "react";
import { Form, Input, Modal } from "antd";
import { toast } from "sonner";
import {
  useCreateBranch,
  useUpdateBranch,
  type ClinicBranchDto,
} from "../api";
import { t } from "@/lib/i18n";

interface BranchFormValues {
  code: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

interface BranchEditorModalProps {
  open: boolean;
  branch: ClinicBranchDto | null;
  onClose: () => void;
}

export function BranchEditorModal({ open, branch, onClose }: BranchEditorModalProps) {
  const [form] = Form.useForm<BranchFormValues>();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const isEditing = Boolean(branch);
  const saving = createBranch.isPending || updateBranch.isPending;

  useEffect(() => {
    if (open) {
      if (branch) {
        form.setFieldsValue({
          code: branch.code,
          name: branch.name,
          address: branch.address ?? "",
          phoneNumber: branch.phoneNumber ?? "",
          email: branch.email ?? "",
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, branch, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    try {
      if (branch) {
        await updateBranch.mutateAsync({
          id: branch.id,
          data: { name: values.name, address: values.address, phoneNumber: values.phoneNumber, email: values.email },
        });
        toast.success(t("Cập nhật chi nhánh thành công"));
      } else {
        await createBranch.mutateAsync(values);
        toast.success(t("Tạo chi nhánh thành công"));
      }
      onClose();
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  return (
    <Modal
      open={open}
      title={isEditing ? t("Sửa chi nhánh") : t("Thêm chi nhánh")}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText={t("Lưu")}
      cancelText={t("Hủy")}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {!isEditing && (
          <Form.Item
            name="code"
            label={t("Mã chi nhánh")}
            rules={[{ required: true, message: t("Vui lòng nhập mã") }]}
          >
            <Input />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label={t("Tên chi nhánh")}
          rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="address" label={t("Địa chỉ")}>
          <Input />
        </Form.Item>
        <div className="settings-row">
          <Form.Item
            name="phoneNumber"
            label={t("Số điện thoại")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Số điện thoại không hợp lệ") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: t("Email không hợp lệ") }]}
          >
            <Input />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
