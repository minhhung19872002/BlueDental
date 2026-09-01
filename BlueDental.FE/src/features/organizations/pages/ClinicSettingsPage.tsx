import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Form, Input, Select, Spin, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,

  SaveOutlined,
  UserOutlined,
  LockOutlined,
  ShopOutlined,
  SafetyOutlined,
  BranchesOutlined,
  TeamOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  useClinicBranch,
  useClinicBranches,
  useDeleteBranch,
  useUpdateClinicBranch,
  type ClinicBranchDto,
} from "../api";
import { authApi } from "@/features/auth/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { describeApiError } from "@/lib/apiError";
import { BranchEditorModal } from "../components/BranchEditorModal";
import { BranchManagerEditorModal, type BranchManagerFormValues } from "../components/BranchManagerEditorModal";
import { branchManagerApi, type BranchManagerDto } from "../api/branchManagerApi";
import {
  branchManagerKeys,
  useBranchManagerList,
  useCreateBranchManager,
  useUpdateBranchManager,
  useDeleteBranchManager,
} from "../api/branchManagerQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { PermissionsTab } from "../components/PermissionsTab";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId, useBranchStore } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMyProfile, useUpdateProfile, uploadProfileAvatar, deleteProfileAvatar } from "@/features/account/api/accountMutations";
import { useStaff, staffKeys } from "@/features/staff/api/staffQueries";
import { getAllProvinces, getWardsByProvince, getProvinceName, getWardName, type LocationOption } from "@/utils/vietnamLocations";
import { t } from "@/lib/i18n";

type TabKey = "info" | "password" | "clinic" | "permission" | "branches" | "branch-manage";

const TAB_ITEMS: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: "info", icon: <UserOutlined />, label: "Thông tin cá nhân" },
  { key: "password", icon: <LockOutlined />, label: "Đổi mật khẩu" },
  { key: "clinic", icon: <ShopOutlined />, label: "Thông tin phòng khám" },
  { key: "permission", icon: <SafetyOutlined />, label: "Phân quyền" },
  { key: "branches", icon: <BranchesOutlined />, label: "Danh sách chi nhánh" },
  { key: "branch-manage", icon: <TeamOutlined />, label: "Quản lý chi nhánh" },
];

/* ── Tab: Thông tin cá nhân ───────────────────────────────────────────── */

function PersonalInfoTab({ branchId }: { branchId: string }) {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const { data: branch, isLoading: branchLoading } = useClinicBranch(branchId);
  const updateBranch = useUpdateClinicBranch();
  const { data: staffData, isLoading: staffLoading } = useStaff(user?.id ?? "");
  const [form] = Form.useForm();
  const selectedProvinceId = Form.useWatch("provinceId", form);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (selectedProvinceId) {
      loadWards(selectedProvinceId);
    } else {
      setWards([]);
    }
  }, [selectedProvinceId, loadWards]);

  useEffect(() => {
    if (profile && branch) {
      form.setFieldsValue({
        name: profile.name ?? "",
        phoneNumber: profile.phoneNumber ?? branch.phoneNumber ?? "",
        email: profile.email ?? "",
        provinceId: branch.provinceId ?? undefined,
        wardId: branch.wardId ?? undefined,
        address: branch.address ?? "",
      });
      if (branch.provinceId) loadWards(branch.provinceId);
    }
  }, [profile, branch, form, loadWards]);

  useEffect(() => {
    if (staffData !== undefined) {
      setAvatarPreview(staffData?.avatarUrl ?? null);
    }
  }, [staffData]);

  const handleProvinceChange = (value: string) => {
    form.setFieldsValue({ wardId: undefined });
    loadWards(value ?? "");
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const clean = (v: string | undefined) => v?.trim() || undefined;

    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        name: values.name,
        email: values.email,
        phoneNumber: clean(values.phoneNumber),
      });
      if (user) {
        setAuth({ ...user, name: values.name, email: values.email });
      }

      if (user?.id && avatarFile instanceof File) {
        await uploadProfileAvatar(user.id, avatarFile);
        setAvatarFile(undefined);
        void queryClient.invalidateQueries({ queryKey: staffKeys.detail(user.id) });
      } else if (user?.id && avatarFile === null) {
        await deleteProfileAvatar(user.id);
        setAvatarFile(undefined);
        setAvatarPreview(null);
        void queryClient.invalidateQueries({ queryKey: staffKeys.detail(user.id) });
      }

      await updateBranch.mutateAsync({
        id: branchId,
        input: {
          name: branch?.name ?? "",
          phoneNumber: clean(values.phoneNumber),
          email: clean(values.email),
          address: clean(values.address),
          provinceId: values.provinceId || undefined,
          wardId: values.wardId || undefined,
        },
      });
      toast.success(t("Cập nhật thông tin thành công"));
    } catch {
      // Global MutationCache.onError handles toast
    } finally {
      setSaving(false);
    }
  };

  const isLoading = profileLoading || branchLoading || staffLoading;
  if (isLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <>
      <div className="profile-content-title">{t("Thông tin cá nhân")}</div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAvatarFile(file);
            const url = URL.createObjectURL(file);
            setAvatarPreview((prev) => {
              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
              return url;
            });
            e.target.value = "";
          }}
        />
        <div
          className="profile-avatar-wrapper"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="profile-avatar-img" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#99a0bd">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
          <span className="profile-avatar-edit">
            <EditOutlined />
          </span>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--bd-ink)" }}>{profile?.name}</div>
          <div style={{ fontSize: 13, color: "var(--bd-muted)" }}>{profile?.email}</div>
          <div style={{ fontSize: 12, color: "var(--bd-faint)", marginTop: 2 }}>
            {t("ID phòng khám")}: {branchId}
          </div>
        </div>
      </div>
      {avatarPreview && (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          style={{ marginBottom: 20 }}
          onClick={() => {
            if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
            setAvatarFile(null);
            setAvatarPreview(null);
          }}
        >
          {t("Xóa ảnh")}
        </Button>
      )}
      {!avatarPreview && <div style={{ marginBottom: 20 }} />}

      <Form form={form} layout="vertical" className="settings-form">
        <Form.Item name="name" label={t("Họ và tên")} rules={[{ required: true, message: t("Vui lòng nhập tên") }]}>
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
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: t("Email không hợp lệ") }]}>
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Tỉnh/ Thành phố")}>
            <Select
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
          <Input />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {t("Lưu Thay Đổi")}
          </Button>
        </div>
      </Form>
    </>
  );
}

/* ── Tab: Đổi mật khẩu ───────────────────────────────────────────────── */

const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

function ChangePasswordTab() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t("Đổi mật khẩu thành công"));
      form.resetFields();
    } catch (error) {
      const info = describeApiError(error);
      if (info.code === "BlueDental:Auth:ChangePasswordFailed") {
        toast.error(t("Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại."));
      } else {
        toast.error(info.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="profile-content-title">{t("Đổi mật khẩu")}</div>
      <Form form={form} layout="vertical" className="settings-form" style={{ maxWidth: 400 }}>
        <Form.Item
          name="currentPassword"
          label={t("Mật khẩu hiện tại")}
          rules={[{ required: true, message: t("Vui lòng nhập mật khẩu hiện tại") }]}
        >
          <Input.Password placeholder={t("Mật khẩu hiện tại")} />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t("Mật khẩu mới")}
          rules={[
            { required: true, message: t("Vui lòng nhập mật khẩu mới") },
            { pattern: PASSWORD_PATTERN, message: t("Tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt") },
          ]}
        >
          <Input.Password placeholder={t("Mật khẩu mới")} />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t("Nhập lại mật khẩu mới")}
          rules={[
            { required: true, message: t("Vui lòng nhập lại mật khẩu") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                return Promise.reject(new Error(t("Mật khẩu không khớp")));
              },
            }),
          ]}
        >
          <Input.Password placeholder={t("Nhập lại mật khẩu mới")} />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={saving} onClick={() => void handleSave()}>
            {t("Lưu Thay Đổi")}
          </Button>
        </div>
      </Form>
    </>
  );
}

/* ── Tab: Thông tin phòng khám ────────────────────────────────────────── */

function ClinicInfoTab({ branchId }: { branchId: string }) {
  const [form] = Form.useForm();
  const { data: branch, isLoading } = useClinicBranch(branchId);
  const updateBranch = useUpdateClinicBranch();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [saving, setSaving] = useState(false);
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
    if (selectedProvinceId) {
      loadWards(selectedProvinceId);
    } else {
      setWards([]);
    }
  }, [selectedProvinceId, loadWards]);

  useEffect(() => {
    if (branch) {
      form.setFieldsValue({
        code: branch.code ?? "",
        name: branch.name ?? "",
        phoneNumber: branch.phoneNumber ?? "",
        email: branch.email ?? "",
        provinceId: branch.provinceId ?? undefined,
        wardId: branch.wardId ?? undefined,
        address: branch.address ?? "",
        slogan: branch.slogan ?? "",
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
    setSaving(true);
    try {
      await updateBranch.mutateAsync({
        id: branchId,
        input: {
          name: values.name,
          phoneNumber: clean(values.phoneNumber),
          email: clean(values.email),
          address: clean(values.address),
          provinceId: values.provinceId || undefined,
          wardId: values.wardId || undefined,
          slogan: clean(values.slogan),
        },
      });
      if (user) {
        setAuth({ ...user, clinicTagline: clean(values.slogan) ?? null, clinicName: values.name });
      }
      toast.success(t("Cập nhật thông tin phòng khám thành công"));
    } catch {
      // Global MutationCache.onError handles toast
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <>
      <div className="profile-content-title">{t("Thông tin phòng khám")}</div>
      <Form form={form} layout="vertical" className="settings-form">
        <div className="settings-row">
          <Form.Item name="code" label={t("Mã cửa hàng")}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="name" label={t("Tên chi nhánh")} rules={[{ required: true, message: t("Vui lòng nhập tên chi nhánh") }]}>
            <Input />
          </Form.Item>
        </div>
        <Form.Item name="slogan" label="Slogan" rules={[{ max: 500, message: t("Slogan tối đa 500 ký tự") }]}>
          <Input placeholder={t("Nhập slogan phòng khám")} />
        </Form.Item>
        <div className="settings-row">
          <Form.Item
            name="phoneNumber"
            label={t("Số điện thoại")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Số điện thoại không hợp lệ") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: t("Email không hợp lệ") }]}>
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Tỉnh/ Thành phố")}>
            <Select
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
          <Input />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={saving} onClick={() => void handleSave()}>
            {t("Lưu Thay Đổi")}
          </Button>
        </div>
      </Form>
    </>
  );
}

/* ── Tab: Danh sách chi nhánh ─────────────────────────────────────────── */

function BranchListTab() {
  const { data: branches, isLoading } = useClinicBranches(false, true);
  const deleteBranch = useDeleteBranch();
  const pagination = useTablePagination(20);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClinicBranchDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClinicBranchDto | null>(null);

  const confirmDeleteBranch = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBranch.mutateAsync(pendingDelete.id);
      toast.success(t("Xóa chi nhánh thành công"));
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDelete(null);
    }
  };

  const columns: ColumnsType<ClinicBranchDto> = [
    {
      key: "id",
      title: "ID",
      dataIndex: "id",
      width: 280,
      render: (v: string) => <span style={{ fontSize: 13, color: "var(--bd-muted)" }}>{v}</span>,
    },
    {
      key: "name",
      title: t("Tên chi nhánh"),
      dataIndex: "name",
      width: 280,
    },
    {
      key: "phoneNumber",
      title: t("Số điện thoại"),
      dataIndex: "phoneNumber",
      width: 160,
      render: (v: string) => v || "—",
    },
    {
      key: "email",
      title: "Email",
      dataIndex: "email",
      width: 260,
      render: (v: string) => v || "—",
    },
    {
      key: "lastModificationTime",
      title: t("Lần cập nhật cuối"),
      dataIndex: "lastModificationTime",
      width: 200,
      render: (v: string) => {
        if (!v) return "—";
        const d = new Date(v);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 110,
      align: "center",
      render: (_, record) => {
        if (record.isDeleted) return null;
        return (
          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); setEditingBranch(record); setBranchModalOpen(true); }}
              />
            </Tooltip>
            <Tooltip title={t("Xóa")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => { e.stopPropagation(); setPendingDelete(record); }}
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="settings-section-header">
        <div className="profile-content-title" style={{ marginBottom: 0 }}>{t("Danh sách chi nhánh")}</div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingBranch(null); setBranchModalOpen(true); }}
        >
          {t("Thêm chi nhánh")}
        </Button>
      </div>

      <DataTable<ClinicBranchDto>
        columns={columns}
        dataSource={[...(branches ?? [])].sort((a, b) => {
          const ta = a.lastModificationTime ?? "";
          const tb = b.lastModificationTime ?? "";
          return tb.localeCompare(ta);
        })}
        rowKey="id"
        loading={isLoading}
        pagination={pagination.buildConfig((branches ?? []).length)}
        rowClassName={(record) => record.isDeleted ? "row-deleted" : ""}
      />

      <BranchEditorModal
        open={branchModalOpen}
        branch={editingBranch}
        onClose={() => setBranchModalOpen(false)}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("chi nhánh")}
        name={pendingDelete?.name ?? ""}
        pending={deleteBranch.isPending}
        onConfirm={() => void confirmDeleteBranch()}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

/* ── Tab: Quản lý chi nhánh ───────────────────────────────────────────── */

function useFullAddressMap(managers: BranchManagerDto[]) {
  const [addressMap, setAddressMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const result = new Map<string, string>();
      for (const mgr of managers) {
        const parts: string[] = [];
        if (mgr.address) parts.push(mgr.address);
        const wardName = await getWardName(mgr.provinceId, mgr.wardId);
        if (wardName) parts.push(wardName);
        const provinceName = await getProvinceName(mgr.provinceId);
        if (provinceName) parts.push(provinceName);
        result.set(mgr.id, parts.length > 0 ? parts.join(", ") : "");
      }
      if (!cancelled) setAddressMap(result);
    }
    if (managers.length > 0) void resolve();
    return () => { cancelled = true; };
  }, [managers]);
  return addressMap;
}

function BranchManageTab() {
  const queryClient = useQueryClient();
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<BranchManagerDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDeleteMgr, setPendingDeleteMgr] = useState<BranchManagerDto | null>(null);
  const debouncedKeyword = useDebounce(keyword);
  const currentBranchId = useBranchStore((s) => s.currentBranchId);

  useEffect(() => {
    pagination.resetToFirstPage();
  }, [debouncedKeyword, currentBranchId]);

  const { data, isLoading } = useBranchManagerList({
    filter: debouncedKeyword.trim() || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    branchId: currentBranchId ?? undefined,
  });
  const { data: branches } = useClinicBranches();
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const createMgr = useCreateBranchManager();
  const updateMgr = useUpdateBranchManager();
  const deleteMgr = useDeleteBranchManager();

  const rows = data?.items ?? [];
  const fullAddressMap = useFullAddressMap(rows);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (mgr: BranchManagerDto) => {
    setEditing(mgr);
    setModalOpen(true);
  };

  const confirmDeleteMgr = async () => {
    if (!pendingDeleteMgr) return;
    try {
      await deleteMgr.mutateAsync(pendingDeleteMgr.id);
      toast.success(t("Đã xoá quản lý chi nhánh"));
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDeleteMgr(null);
    }
  };

  const handleSubmit = async (values: BranchManagerFormValues, avatarFile?: File | null | undefined) => {
    try {
      let mgrId: string;
      if (editing) {
        await updateMgr.mutateAsync({
          id: editing.id,
          data: {
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber,
            branchIds: values.branchIds,
            address: values.address || undefined,
            provinceId: values.provinceId || undefined,
            wardId: values.wardId || undefined,
          },
        });
        mgrId = editing.id;
      } else {
        const result = await createMgr.mutateAsync({
          password: values.password,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          branchIds: values.branchIds,
          address: values.address || undefined,
          provinceId: values.provinceId || undefined,
          wardId: values.wardId || undefined,
        });
        mgrId = result.id;
      }

      setModalOpen(false);
      toast.success(editing ? t("Đã cập nhật quản lý chi nhánh") : t("Đã tạo quản lý chi nhánh"));

      if (avatarFile instanceof File) {
        branchManagerApi.uploadAvatar(mgrId, avatarFile).then(
          () => void queryClient.invalidateQueries({ queryKey: branchManagerKeys.all }),
          () => toast.error(t("Tải ảnh đại diện thất bại")),
        );
      } else if (avatarFile === null && editing?.avatarUrl) {
        branchManagerApi.deleteAvatar(mgrId).then(
          () => void queryClient.invalidateQueries({ queryKey: branchManagerKeys.all }),
          () => toast.error(t("Xóa ảnh đại diện thất bại")),
        );
      }
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  const columns: ColumnsType<BranchManagerDto> = [
    {
      key: "fullName",
      title: t("Tên"),
      width: 240,
      render: (_, record) => record.fullName || record.userName,
    },
    {
      key: "phoneNumber",
      title: t("Số điện thoại"),
      dataIndex: "phoneNumber",
      width: 180,
      render: (v) => v || "—",
    },
    {
      key: "email",
      title: "Email",
      dataIndex: "email",
      width: 280,
      render: (v) => v || "—",
    },
    {
      key: "roleNames",
      title: t("Phân quyền"),
      dataIndex: "roleNames",
      width: 200,
      render: (v: string[]) => (v?.length > 0 ? v.join(", ") : "—"),
    },
    {
      key: "address",
      title: t("Địa chỉ"),
      width: 350,
      render: (_, record) => fullAddressMap.get(record.id) || record.address || "—",
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 110,
      align: "center",
      render: (_, record) => (
        <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); openEdit(record); }}
            />
          </Tooltip>
          <Tooltip title={t("Xoá")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => { e.stopPropagation(); setPendingDeleteMgr(record); }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="profile-content-title">{t("Quản lý chi nhánh")}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t("Tìm theo tên, email, số điện thoại...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t("Tạo")}
        </Button>
      </div>

      <DataTable<BranchManagerDto>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        pagination={pagination.buildConfig(data?.totalCount)}
      />

      <BranchManagerEditorModal
        open={modalOpen}
        manager={editing}
        branchOptions={branchOptions}
        loading={createMgr.isPending || updateMgr.isPending}
        onSubmit={(v, avatar) => void handleSubmit(v, avatar)}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteMgr !== null}
        noun={t("quản lý chi nhánh")}
        name={pendingDeleteMgr?.fullName || pendingDeleteMgr?.userName || ""}
        pending={deleteMgr.isPending}
        onConfirm={() => void confirmDeleteMgr()}
        onClose={() => setPendingDeleteMgr(null)}
      />
    </>
  );
}

/* ── Main ProfilePage ─────────────────────────────────────────────────── */

export function ClinicSettingsPage() {
  const branchId = useCurrentBranchId();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "info";

  const handleTabChange = (key: TabKey) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "info":
        return <PersonalInfoTab branchId={branchId} />;
      case "password":
        return <ChangePasswordTab />;
      case "clinic":
        return <ClinicInfoTab branchId={branchId} />;
      case "permission":
        return <PermissionsTab />;
      case "branches":
        return <BranchListTab />;
      case "branch-manage":
        return <BranchManageTab />;
      default:
        return <PersonalInfoTab branchId={branchId} />;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("Hồ sơ")}</h1>
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-sidebar">
          <div className="profile-sidebar-title">{t("Hồ sơ")}</div>
          <div className="profile-sidebar-menu">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.key}
                className={[
                  "profile-sidebar-item",
                  activeTab === item.key && "profile-sidebar-item--active",
                ].filter(Boolean).join(" ")}
                onClick={() => handleTabChange(item.key)}
              >
                {item.icon}
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>
        <div className={activeTab === "permission" ? "profile-content profile-content--perm" : "profile-content"}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
