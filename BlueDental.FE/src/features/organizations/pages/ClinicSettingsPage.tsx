import { useEffect } from "react";
import { Button, Empty, Form, Input, Spin, message } from "antd";
import {
  useClinicBranch,
  useClinicBranches,
  useUpdateClinicBranch,
} from "../api";
import { useStaffList, useStaffRoleNames } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { PageHeader } from "@/components/PageHeader";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface BranchFormValues {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * Cài đặt phòng khám.
 *
 * The design's general-info card lists a tagline, opening hours and a calendar
 * step. None of those exist on the branch the API updates, so the card carries
 * the fields the server actually stores — a Save that silently drops what was
 * typed would be worse than a shorter form.
 */
export function ClinicSettingsPage() {
  const [form] = Form.useForm<BranchFormValues>();
  const branchId = useCurrentBranchId();

  const { data: branch, isLoading } = useClinicBranch(branchId);
  const { data: branches } = useClinicBranches();
  const { data: roleNames } = useStaffRoleNames();
  const { data: staff } = useStaffList({ maxResultCount: 200 });
  const updateBranch = useUpdateClinicBranch();

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
      message.success(t("Đã lưu cài đặt phòng khám"));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const staffPerRole = new Map<string, number>();
  for (const member of staff?.items ?? []) {
    for (const role of member.roleNames) {
      staffPerRole.set(role, (staffPerRole.get(role) ?? 0) + 1);
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title={t("Cài đặt phòng khám")}
        subtitle={t("Thông tin thương hiệu, chi nhánh và phân quyền")}
      />

      <div className="settings-split">
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
                <Form.Item name="phoneNumber" label={t("Số điện thoại")}>
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

        <div className="settings-side">
          <div className="page-card">
            <div className="dash-card-title" style={{ marginBottom: 14 }}>
              {t("Chi nhánh")}
            </div>
            {(branches ?? []).length === 0 ? (
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
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="page-card">
            <div className="dash-card-title" style={{ marginBottom: 14 }}>
              {t("Phân quyền")}
            </div>
            {(roleNames ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có vai trò")} />
            ) : (
              <div className="settings-roles">
                {(roleNames ?? []).map((role) => (
                  <div key={role} className="settings-role">
                    <span className="settings-role-name">{role}</span>
                    <span className="settings-role-count">
                      {t("{0} người", staffPerRole.get(role) ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
