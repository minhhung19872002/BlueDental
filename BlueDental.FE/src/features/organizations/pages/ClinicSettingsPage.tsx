import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Empty, Form, Input, Popconfirm, Spin } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, RightOutlined } from "@ant-design/icons";
import {
  useClinicBranch,
  useClinicBranches,
  useDeleteBranch,
  useUpdateClinicBranch,
  type ClinicBranchDto,
} from "../api";
import { BranchEditorModal } from "../components/BranchEditorModal";
import { useStaffList, useStaffRoleNames } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface BranchFormValues {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export function ClinicSettingsPage() {
  const [form] = Form.useForm<BranchFormValues>();
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();

  const { data: branch, isLoading } = useClinicBranch(branchId);
  const { data: branches, isLoading: branchesLoading } = useClinicBranches();
  const { data: roleNames, isLoading: rolesLoading } = useStaffRoleNames();
  const { data: staff, isLoading: staffLoading } = useStaffList({ maxResultCount: 200 });
  const updateBranch = useUpdateClinicBranch();
  const deleteBranch = useDeleteBranch();

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClinicBranchDto | null>(null);

  useEffect(() => {
    if (branch) {
      form.setFieldsValue({
        name: branch.name,
        address: branch.address ?? "",
        phoneNumber: branch.phoneNumber ?? "",
        email: branch.email ?? "",
      });
    }
  }, [branch, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      await updateBranch.mutateAsync({ id: branchId, input: values });
      toast.success(t("Đã lưu cài đặt phòng khám"));
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  const handleDeleteBranch = async (id: string) => {
    try {
      await deleteBranch.mutateAsync(id);
      toast.success(t("Xóa chi nhánh thành công"));
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  const openAddBranch = () => {
    setEditingBranch(null);
    setBranchModalOpen(true);
  };

  const openEditBranch = (b: ClinicBranchDto) => {
    setEditingBranch(b);
    setBranchModalOpen(true);
  };

  const staffPerRole = new Map<string, number>();
  for (const member of staff?.items ?? []) {
    for (const role of member.roleNames) {
      staffPerRole.set(role, (staffPerRole.get(role) ?? 0) + 1);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("Cài đặt phòng khám")}</h1>
          <p className="page-header-subtitle">
            {t("Thông tin thương hiệu, chi nhánh và phân quyền")}
          </p>
        </div>
      </div>

      <div className="settings-split">
        {/* ── General info form ── */}
        <div className="page-card">
          <div className="dash-card-title" style={{ marginBottom: 15 }}>
            {t("Thông tin chung")}
          </div>
          {isLoading ? (
            <Spin />
          ) : (
            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item
                name="name"
                label={t("Tên phòng khám")}
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
              <Button
                type="primary"
                block
                size="large"
                loading={updateBranch.isPending}
                onClick={() => void handleSave()}
              >
                {t("Lưu thay đổi")}
              </Button>
            </Form>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="settings-side">
          {/* Branches */}
          <div className="page-card">
            <div className="settings-card-header">
              <span className="dash-card-title">{t("Chi nhánh")}</span>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={openAddBranch}
              />
            </div>
            {branchesLoading ? (
              <Spin size="small" />
            ) : (branches ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có chi nhánh")} />
            ) : (
              <div className="dash-list">
                {(branches ?? []).map((item) => (
                  <div key={item.id} className="settings-branch">
                    <span className="settings-dot" />
                    <span className="dash-row-main">
                      <span className="dash-row-title">{item.name}</span>
                      <span className="dash-row-caption">{item.address ?? "—"}</span>
                    </span>
                    <span className="settings-branch-actions">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditBranch(item)}
                      />
                      <Popconfirm
                        title={t("Bạn có chắc muốn xóa chi nhánh này?")}
                        onConfirm={() => void handleDeleteBranch(item.id)}
                        okText={t("Xóa")}
                        cancelText={t("Hủy")}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permissions / roles */}
          <div className="page-card">
            <div className="dash-card-title" style={{ marginBottom: 14 }}>
              {t("Phân quyền")}
            </div>
            {rolesLoading || staffLoading ? (
              <Spin size="small" />
            ) : (roleNames ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có vai trò")} />
            ) : (
              <div className="settings-roles">
                {(roleNames ?? []).map((role) => (
                  <div
                    key={role}
                    className="settings-role settings-role--clickable"
                    onClick={() => navigate("/staff")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate("/staff"); }}
                  >
                    <span className="settings-role-name">{role}</span>
                    <span className="settings-role-count">
                      {t("{0} người", staffPerRole.get(role) ?? 0)}
                    </span>
                    <RightOutlined className="settings-role-arrow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BranchEditorModal
        open={branchModalOpen}
        branch={editingBranch}
        onClose={() => setBranchModalOpen(false)}
      />
    </div>
  );
}
