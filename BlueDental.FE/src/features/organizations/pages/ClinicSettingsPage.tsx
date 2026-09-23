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
import { validateImageFile, IMAGE_ACCEPT } from "@/utils/validateImageFile";
import {
  useClinicBranch,
  useClinicBranches,
  useDeleteBranch,
  useUpdateClinicBranch,
  type ClinicBranchDto,
} from "../api";
import { authApi } from "@/features/auth/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
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
import { ForbiddenResult } from "@/components/ForbiddenResult";
import { isAnyGranted } from "@/lib/permissions";
import { abilityPermission, LegacyPermissions } from "@/lib/permissionConstants";
import { useMyProfile, useUpdateProfile, uploadProfileAvatar, deleteProfileAvatar } from "@/features/account/api/accountMutations";
import { useStaff, staffKeys } from "@/features/staff/api/staffQueries";
import { getAllProvinces, getWardsByProvince, getProvinceName, getWardName, type LocationOption } from "@/utils/vietnamLocations";
import { getLocale, t } from "@/lib/i18n";

type TabKey = "info" | "password" | "clinic" | "permission" | "branches" | "branch-manage";

/**
 * The account's own tabs carry no permission; the clinic-wide ones need the
 * same permission their server endpoints check (the permission tree, the
 * branch list, the branch-manager list), so a tab the user may not use is
 * not offered (owner's decision, 2026-09-22: hide, do not disable).
 */
const TAB_ITEMS: { key: TabKey; icon: React.ReactNode; label: string; permissions: readonly string[] }[] = [
  { key: "info", icon: <UserOutlined />, label: "Organization:TabPersonalInfo", permissions: [] },
  { key: "password", icon: <LockOutlined />, label: "Organization:TabChangePassword", permissions: [] },
  { key: "clinic", icon: <ShopOutlined />, label: "Organization:TabClinicInfo", permissions: [LegacyPermissions.Organizations.View] },
  { key: "permission", icon: <SafetyOutlined />, label: "Organization:TabPermissions", permissions: [abilityPermission("rolePermission", "read")] },
  { key: "branches", icon: <BranchesOutlined />, label: "Organization:TabBranchList", permissions: [LegacyPermissions.Organizations.View] },
  { key: "branch-manage", icon: <TeamOutlined />, label: "Organization:TabBranchManage", permissions: [LegacyPermissions.BranchManager.View] },
];

/* ── Tab: Thông tin cá nhân ───────────────────────────────────────────── */

function PersonalInfoTab({ branchId }: { branchId: string }) {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const { data: branch } = useClinicBranch(branchId);
  const updateBranch = useUpdateClinicBranch();
  const { data: staffData } = useStaff(user?.id ?? "");
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
    if (!profile) return;
    form.setFieldsValue({
      name: profile.name ?? "",
      phoneNumber: profile.phoneNumber ?? branch?.phoneNumber ?? "",
      email: profile.email ?? "",
      provinceId: branch?.provinceId ?? undefined,
      wardId: branch?.wardId ?? undefined,
      address: branch?.address ?? "",
    });
    if (branch?.provinceId) loadWards(branch.provinceId);
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

      if (branch) {
        await updateBranch.mutateAsync({
          id: branchId,
          input: {
            name: branch.name ?? "",
            phoneNumber: clean(values.phoneNumber),
            email: clean(values.email),
            address: clean(values.address),
            provinceId: values.provinceId || undefined,
            wardId: values.wardId || undefined,
          },
        });
      }
      toast.success(t("Organization:PersonalSaveSuccess"));
    } catch {
      // Global MutationCache.onError handles toast
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <>
      <div className="profile-content-title">{t("Organization:ProfileTitle")}</div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const error = validateImageFile(file);
            if (error) { toast.error(error); e.target.value = ""; return; }
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
            {t("Organization:BranchId")}: {branchId}
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
          {t("Organization:DeletePhoto")}
        </Button>
      )}
      {!avatarPreview && <div style={{ marginBottom: 20 }} />}

      <Form form={form} layout="vertical" className="settings-form">
        <Form.Item name="name" label={t("Organization:NameLabel")} rules={[{ required: true, message: t("Organization:NameRequired") }]}>
          <Input />
        </Form.Item>
        <div className="settings-row">
          <Form.Item
            name="phoneNumber"
            label={t("Organization:PhoneLabelField")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Organization:PhoneInvalid") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("Organization:EmailLabel")} rules={[{ type: "email", message: t("Organization:EmailInvalid") }]}>
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Organization:ProvinceLabelField")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:ProvincePlaceholderField")}
              optionFilterProp="label"
              options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              onChange={handleProvinceChange}
            />
          </Form.Item>
          <Form.Item name="wardId" label={t("Organization:WardLabelField")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:WardPlaceholderField")}
              optionFilterProp="label"
              options={wards.map((w) => ({ value: w.code, label: w.name }))}
              disabled={!selectedProvinceId}
            />
          </Form.Item>
        </div>
        <Form.Item name="address" label={t("Organization:AddressField")}>
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
            {t("Organization:SaveChanges")}
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
      toast.success(t("Organization:PasswordChanged"));
      form.resetFields();
    } catch (error) {
      const info = describeApiError(error);
      if (info.code === "BlueDental:Auth:ChangePasswordFailed") {
        toast.error(t("Organization:PasswordWrong"));
      } else {
        toast.error(info.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="profile-content-title">{t("Organization:ChangePasswordTitle")}</div>
      <Form form={form} layout="vertical" className="settings-form" style={{ maxWidth: 400 }}>
        <Form.Item
          name="currentPassword"
          label={t("Organization:CurrentPasswordLabel")}
          rules={[{ required: true, message: t("Organization:CurrentPasswordRequired") }]}
        >
          <Input.Password placeholder={t("Organization:CurrentPasswordPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t("Organization:NewPasswordLabel")}
          rules={[
            { required: true, message: t("Organization:NewPasswordRequired") },
            { pattern: PASSWORD_PATTERN, message: t("Organization:NewPasswordHint") },
          ]}
        >
          <Input.Password placeholder={t("Organization:NewPasswordPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t("Organization:ConfirmNewPasswordLabel")}
          rules={[
            { required: true, message: t("Organization:ConfirmNewPasswordRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                return Promise.reject(new Error(t("Organization:NewPasswordMismatch")));
              },
            }),
          ]}
        >
          <Input.Password placeholder={t("Organization:ConfirmNewPasswordPlaceholder")} />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={saving} onClick={() => void handleSave()}>
            {t("Organization:SaveChanges")}
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
      toast.success(t("Organization:ClinicInfoSaved"));
    } catch {
      // Global MutationCache.onError handles toast
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Spin style={{ display: "block", textAlign: "center", padding: 40 }} />;

  return (
    <>
      <div className="profile-content-title">{t("Organization:ClinicInfoTitle")}</div>
      <Form form={form} layout="vertical" className="settings-form">
        <div className="settings-row">
          <Form.Item name="code" label={t("Organization:ClinicCodeLabel")}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="name" label={t("Organization:ClinicNameLabel")} rules={[{ required: true, message: t("Organization:ClinicNameRequired") }]}>
            <Input />
          </Form.Item>
        </div>
        <Form.Item name="slogan" label={t("Organization:SloganLabel")} rules={[{ max: 500, message: t("Organization:SloganMaxLength") }]}>
          <Input placeholder={t("Organization:SloganPlaceholder")} />
        </Form.Item>
        <div className="settings-row">
          <Form.Item
            name="phoneNumber"
            label={t("Organization:PhoneLabelField")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Organization:PhoneInvalid") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("Organization:EmailLabel")} rules={[{ type: "email", message: t("Organization:EmailInvalid") }]}>
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Organization:ProvinceLabelField")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:ProvincePlaceholderField")}
              optionFilterProp="label"
              options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              onChange={handleProvinceChange}
            />
          </Form.Item>
          <Form.Item name="wardId" label={t("Organization:WardLabelField")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:WardPlaceholderField")}
              optionFilterProp="label"
              options={wards.map((w) => ({ value: w.code, label: w.name }))}
              disabled={!selectedProvinceId}
            />
          </Form.Item>
        </div>
        <Form.Item name="address" label={t("Organization:AddressField")}>
          <Input />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={saving} onClick={() => void handleSave()}>
            {t("Organization:SaveChanges")}
          </Button>
        </div>
      </Form>
    </>
  );
}

/* ── Tab: Danh sách chi nhánh ─────────────────────────────────────────── */

function BranchListTab() {
  const ability = useAbility("branchManager");
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
      toast.success(t("Organization:BranchDeleted"));
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
      title: t("Organization:BranchNameCol"),
      dataIndex: "name",
      width: 280,
    },
    {
      key: "phoneNumber",
      title: t("Organization:PhoneCol"),
      dataIndex: "phoneNumber",
      width: 160,
      render: (v: string) => v || "—",
    },
    {
      key: "email",
      title: t("Organization:EmailLabel"),
      dataIndex: "email",
      width: 260,
      render: (v: string) => v || "—",
    },
    {
      key: "lastModificationTime",
      title: t("Organization:LastUpdatedCol"),
      dataIndex: "lastModificationTime",
      width: 200,
      render: (v: string) => {
        if (!v) return "—";
        const d = new Date(v);
        return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    },
    ...((ability.canUpdate || ability.canDelete) ? [{
      key: "actions" as const,
      title: t("Common:Actions"),
      width: 110,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: unknown, record: ClinicBranchDto) => {
        if (record.isDeleted) return null;
        return (
          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
            {ability.canUpdate && (
              <Tooltip title={t("Common:Edit")}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => { e.stopPropagation(); setEditingBranch(record); setBranchModalOpen(true); }}
                />
              </Tooltip>
            )}
            {ability.canDelete && (
              <Tooltip title={t("Common:Delete")}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(record); }}
                />
              </Tooltip>
            )}
          </div>
        );
      },
    }] : []),
  ];

  return (
    <>
      <div className="settings-section-header">
        <div className="profile-content-title" style={{ marginBottom: 0 }}>{t("Organization:BranchListTitle")}</div>
        {ability.canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingBranch(null); setBranchModalOpen(true); }}
          >
            {t("Organization:AddBranchBtn")}
          </Button>
        )}
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
        noun={t("Organization:BranchNoun")}
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
  const ability = useAbility("branchManager");
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
      toast.success(t("Organization:ManagerDeleted"));
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
      toast.success(editing ? t("Organization:ManagerUpdated") : t("Organization:ManagerCreated"));

      if (avatarFile instanceof File) {
        branchManagerApi.uploadAvatar(mgrId, avatarFile).then(
          () => void queryClient.invalidateQueries({ queryKey: branchManagerKeys.all }),
          () => toast.error(t("Organization:UploadAvatarFailed")),
        );
      } else if (avatarFile === null && editing?.avatarUrl) {
        branchManagerApi.deleteAvatar(mgrId).then(
          () => void queryClient.invalidateQueries({ queryKey: branchManagerKeys.all }),
          () => toast.error(t("Organization:DeleteAvatarFailed")),
        );
      }
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  const columns: ColumnsType<BranchManagerDto> = [
    {
      key: "fullName",
      title: t("Organization:ManagerNameCol"),
      width: 240,
      render: (_, record) => record.fullName || record.userName,
    },
    {
      key: "phoneNumber",
      title: t("Organization:ManagerPhoneCol"),
      dataIndex: "phoneNumber",
      width: 180,
      render: (v) => v || "—",
    },
    {
      key: "email",
      title: t("Organization:EmailLabel"),
      dataIndex: "email",
      width: 280,
      render: (v) => v || "—",
    },
    {
      key: "roleNames",
      title: t("Organization:PermissionCol"),
      dataIndex: "roleNames",
      width: 200,
      render: (v: string[]) => (v?.length > 0 ? v.join(", ") : "—"),
    },
    {
      key: "address",
      title: t("Organization:ManagerAddressCol"),
      width: 350,
      render: (_, record) => fullAddressMap.get(record.id) || record.address || "—",
    },
    ...((ability.canUpdate || ability.canDelete) ? [{
      key: "actions" as const,
      title: t("Common:Actions"),
      width: 110,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: unknown, record: BranchManagerDto) => (
        <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
          {ability.canUpdate && (
            <Tooltip title={t("Common:Edit")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); openEdit(record); }}
              />
            </Tooltip>
          )}
          {ability.canDelete && (
            <Tooltip title={t("Common:Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => { e.stopPropagation(); setPendingDeleteMgr(record); }}
              />
            </Tooltip>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <div className="profile-content-title">{t("Organization:ManagerSectionTitle")}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t("Organization:SearchManagerPlaceholder")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
          allowClear
        />
        {ability.canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("Organization:CreateManagerBtn")}
          </Button>
        )}
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
        noun={t("Organization:ManagerNoun")}
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
  const permissions = useAuthStore((s) => s.user?.permissions);
  const grantedSet = new Set(permissions ?? []);
  const visibleTabs = TAB_ITEMS.filter((item) => isAnyGranted(item.permissions, (p) => grantedSet.has(p)));
  const activeAllowed = visibleTabs.some((item) => item.key === activeTab);

  const handleTabChange = (key: TabKey) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  const renderContent = () => {
    // A typed `?tab=` for a hidden tab gets the same answer a hidden route does.
    if (!activeAllowed) return <ForbiddenResult />;
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
      <PageHeader
        title={t("Organization:SettingsTitle")}
        subtitle={t("Organization:SettingsSubtitle")}
      />

      <div className="profile-layout">
        <div className="profile-sidebar">
          <div className="profile-sidebar-title">{t("Organization:ProfileSidebarTitle")}</div>
          <div className="profile-sidebar-menu">
            {visibleTabs.map((item) => (
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

