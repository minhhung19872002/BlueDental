import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Dropdown, Empty, Form, Input, Modal, Select, Spin, Tabs, Tag } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RightOutlined,
  SaveOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  MoreOutlined,
} from "@ant-design/icons";
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
import { getAllProvinces, getProvinceName, getWardName, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";
import { t } from "@/lib/i18n";

interface BranchFormValues {
  name: string;
  provinceId?: string;
  wardId?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

function GeneralInfoTab({ branchId }: { branchId: string }) {
  const [form] = Form.useForm<BranchFormValues>();
  const { data: branch, isLoading } = useClinicBranch(branchId);
  const updateBranch = useUpdateClinicBranch();
  const selectedProvinceId = Form.useWatch("provinceId", form);

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);

  useEffect(() => {
    getAllProvinces().then(setProvinces);
  }, []);

  const loadWards = useCallback((provinceCode: string) => {
    if (!provinceCode) { setWards([]); return; }
    getWardsByProvince(provinceCode).then(setWards);
  }, []);

  useEffect(() => {
    if (branch) {
      form.setFieldsValue({
        name: branch.name,
        provinceId: branch.provinceId ?? undefined,
        wardId: branch.wardId ?? undefined,
        address: branch.address ?? "",
        phoneNumber: branch.phoneNumber ?? "",
        email: branch.email ?? "",
      });
      if (branch.provinceId) loadWards(branch.provinceId);
    }
  }, [branch, form, loadWards]);

  const handleProvinceChange = (value: string) => {
    form.setFieldsValue({ wardId: undefined });
    loadWards(value ?? "");
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const clean = (v: string | undefined) => v?.trim() || undefined;
    const input = {
      ...values,
      address: clean(values.address),
      phoneNumber: clean(values.phoneNumber),
      email: clean(values.email),
      provinceId: values.provinceId || undefined,
      wardId: values.wardId || undefined,
    };
    try {
      await updateBranch.mutateAsync({ id: branchId, input });
      toast.success(t("Đã lưu cài đặt phòng khám"));
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  if (isLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <Form form={form} layout="vertical" requiredMark={false} className="settings-form">
      <Form.Item
        name="name"
        label={t("Tên phòng khám")}
        rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
      >
        <Input size="large" />
      </Form.Item>
      <div className="settings-row">
        <Form.Item name="provinceId" label={t("Tỉnh/ Thành phố")}>
          <Select
            size="large"
            showSearch
            allowClear
            placeholder={t("Chọn tỉnh/ thành phố")}
            optionFilterProp="label"
            options={provinces.map((p) => ({ value: p.code, label: p.name }))}
            onChange={handleProvinceChange}
          />
        </Form.Item>
        <Form.Item name="wardId" label={t("Xã/ Phường")}>
          <Select
            size="large"
            showSearch
            allowClear
            placeholder={t("Chọn xã/ phường")}
            optionFilterProp="label"
            options={wards.map((w) => ({ value: w.code, label: w.name }))}
            disabled={!selectedProvinceId}
          />
        </Form.Item>
      </div>
      <Form.Item name="address" label={t("Địa chỉ")}>
        <Input size="large" prefix={<EnvironmentOutlined className="settings-input-icon" />} />
      </Form.Item>
      <div className="settings-row">
        <Form.Item
          name="phoneNumber"
          label={t("Số điện thoại")}
          rules={[{ pattern: /^0\d{9,10}$/, message: t("Số điện thoại không hợp lệ") }]}
        >
          <Input size="large" prefix={<PhoneOutlined className="settings-input-icon" />} />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: "email", message: t("Email không hợp lệ") }]}
        >
          <Input size="large" prefix={<MailOutlined className="settings-input-icon" />} />
        </Form.Item>
      </div>
      <Button
        type="primary"
        size="large"
        icon={<SaveOutlined />}
        loading={updateBranch.isPending}
        onClick={() => void handleSave()}
        style={{ marginTop: 8 }}
      >
        {t("Lưu thay đổi")}
      </Button>
    </Form>
  );
}

function BranchCard({
  branch,
  onEdit,
  onDelete,
  deleting,
}: {
  branch: ClinicBranchDto;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [locationLabel, setLocationLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pName, wName] = await Promise.all([
        getProvinceName(branch.provinceId),
        getWardName(branch.provinceId, branch.wardId),
      ]);
      if (cancelled) return;
      const parts = [branch.address, wName, pName].filter(Boolean);
      setLocationLabel(parts.join(", "));
    })();
    return () => { cancelled = true; };
  }, [branch.address, branch.provinceId, branch.wardId]);

  const hasContact = locationLabel || branch.phoneNumber || branch.email;

  return (
    <div className="settings-branch-card">
      <div className="settings-branch-card-header">
        <div className="settings-branch-card-name">{branch.name}</div>
        <Tag color="green" className="settings-branch-card-status">{t("Hoạt động")}</Tag>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", icon: <EditOutlined />, label: t("Chỉnh sửa"), onClick: onEdit },
              { type: "divider" },
              {
                key: "delete",
                icon: <DeleteOutlined />,
                label: deleting ? t("Đang xóa...") : t("Xóa chi nhánh"),
                danger: true,
                disabled: deleting,
                onClick: () => {
                  Modal.confirm({
                    title: t("Xác nhận xóa"),
                    content: t("Bạn có chắc chắn muốn xóa chi nhánh này không?"),
                    okText: t("Xóa"),
                    okType: "danger",
                    cancelText: t("Hủy"),
                    onOk: onDelete,
                  });
                },
              },
            ],
          }}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} className="settings-branch-card-more" />
        </Dropdown>
      </div>

      <div className="settings-branch-card-meta">
        {locationLabel && (
          <span className="settings-branch-card-detail">
            <EnvironmentOutlined /> {locationLabel}
          </span>
        )}
        {branch.phoneNumber && (
          <span className="settings-branch-card-detail">
            <PhoneOutlined /> {branch.phoneNumber}
          </span>
        )}
        {branch.email && (
          <span className="settings-branch-card-detail">
            <MailOutlined /> {branch.email}
          </span>
        )}
        {!hasContact && (
          <span className="settings-branch-card-detail" style={{ color: "var(--bd-faint)" }}>
            {t("Chưa có thông tin liên hệ")}
          </span>
        )}
      </div>
    </div>
  );
}

function BranchesTab() {
  const { data: branches, isLoading } = useClinicBranches();
  const deleteBranch = useDeleteBranch();
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClinicBranchDto | null>(null);

  const handleDeleteBranch = async (id: string) => {
    try {
      await deleteBranch.mutateAsync(id);
      toast.success(t("Xóa chi nhánh thành công"));
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  if (isLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <>
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">{t("Danh sách chi nhánh")}</div>
          <div className="settings-section-desc">
            {t("Quản lý các chi nhánh phòng khám trong hệ thống")}
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingBranch(null); setBranchModalOpen(true); }}
        >
          {t("Thêm chi nhánh")}
        </Button>
      </div>

      {(branches ?? []).length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có chi nhánh")} />
      ) : (
        <div className="settings-branch-grid">
          {(branches ?? []).map((item) => (
            <BranchCard
              key={item.id}
              branch={item}
              onEdit={() => { setEditingBranch(item); setBranchModalOpen(true); }}
              onDelete={() => void handleDeleteBranch(item.id)}
              deleting={deleteBranch.isPending}
            />
          ))}
        </div>
      )}

      <BranchEditorModal
        open={branchModalOpen}
        branch={editingBranch}
        onClose={() => setBranchModalOpen(false)}
      />
    </>
  );
}

function PermissionsTab() {
  const navigate = useNavigate();
  const { data: roleNames, isLoading: rolesLoading } = useStaffRoleNames();
  const { data: staff, isLoading: staffLoading } = useStaffList({ maxResultCount: 200 });

  const staffPerRole = new Map<string, number>();
  for (const member of staff?.items ?? []) {
    for (const role of member.roleNames) {
      staffPerRole.set(role, (staffPerRole.get(role) ?? 0) + 1);
    }
  }

  if (rolesLoading || staffLoading) {
    return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;
  }

  if ((roleNames ?? []).length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có vai trò")} />;
  }

  return (
    <>
      <div className="settings-section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="settings-section-title">{t("Vai trò & phân quyền")}</div>
          <div className="settings-section-desc">
            {t("Nhấn vào vai trò để xem danh sách nhân viên")}
          </div>
        </div>
      </div>
      <div className="settings-roles-grid">
        {(roleNames ?? []).map((role) => {
          const count = staffPerRole.get(role) ?? 0;
          return (
            <div
              key={role}
              className="settings-role-card"
              onClick={() => navigate("/staff")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") navigate("/staff"); }}
            >
              <div className="settings-role-card-left">
                <div className="settings-role-card-avatar">
                  {role.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="settings-role-card-name">{role}</div>
                  <div className="settings-role-card-count">
                    {t("{0} thành viên", count)}
                  </div>
                </div>
              </div>
              <RightOutlined className="settings-role-card-arrow" />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function ClinicSettingsPage() {
  const branchId = useCurrentBranchId();

  const items = [
    {
      key: "general",
      label: t("Thông tin chung"),
      children: <GeneralInfoTab branchId={branchId} />,
    },
    {
      key: "branches",
      label: t("Chi nhánh"),
      children: <BranchesTab />,
    },
    {
      key: "permissions",
      label: t("Phân quyền"),
      children: <PermissionsTab />,
    },
  ];

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

      <div className="settings-tabs-card">
        <Tabs items={items} />
      </div>
    </div>
  );
}
