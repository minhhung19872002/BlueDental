import { useEffect, useMemo, useState } from "react";
import { Button, Descriptions, Divider, Form, Input, Modal, Select, Spin, Typography } from "antd";
import { toast } from "sonner";
import { PillTabs } from "@/components/PillTabs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EditOutlined, UserOutlined } from "@ant-design/icons";
import { useClinicInfo, useUpdateClinicInfo, type UpdateClinicInfoDto } from "../api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { LegacyPermissions } from "@/lib/permissionConstants";
import { t, useLanguage, type Language } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

const { Title, Text, Link } = Typography;

const TIMEZONE_KEYS = [
  { value: "Asia/Ho_Chi_Minh", labelKey: "Settings:TimezoneHCM" },
  { value: "Asia/Bangkok", labelKey: "Settings:TimezoneBKK" },
  { value: "UTC", labelKey: "UTC+0" },
] as const;

const LANGUAGE_KEYS = [
  { value: "vi", labelKey: "Tiếng Việt" },
  { value: "en", labelKey: "English" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND" },
  { value: "USD", label: "USD" },
];

function ClinicInfoTab() {
  const { data: clinic, isLoading } = useClinicInfo();
  const updateMutation = useUpdateClinicInfo();
  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();

  const openEdit = () => {
    if (clinic) {
      form.setFieldsValue({
        name: clinic.name,
        address: clinic.address,
        phoneNumber: clinic.phoneNumber,
        email: clinic.email,
      });
    }
    setEditOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const data: UpdateClinicInfoDto = {
      name: values.name,
      address: values.address,
      phoneNumber: values.phoneNumber,
      email: values.email,
    };
    await updateMutation.mutateAsync(data);
    toast.success(t("Settings:UpdateSuccess"));
    setEditOpen(false);
  };

  if (isLoading) {
    return <Spin style={{ display: "block", marginTop: 40 }} />;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          {t("Settings:ClinicInfoTitle")}
        </Title>
        <Button icon={<EditOutlined />} onClick={openEdit}>
          {t("Settings:EditClinic")}
        </Button>
      </div>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label={t("Settings:ClinicName")}>
          <Text>{clinic?.name ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Settings:Address")}>
          <Text>{clinic?.address ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Settings:Phone")}>
          <Text>{clinic?.phoneNumber ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Email")}>
          <Text>{clinic?.email ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Settings:BranchCode")}>
          <Text>{clinic?.code ?? "—"}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Modal
        open={editOpen}
        title={t("Settings:EditClinicTitle")}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        confirmLoading={updateMutation.isPending}
        okText={t("Common:Save")}
        cancelText={t("Common:Cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("Settings:ClinicName")}
            rules={[{ required: true, message: t("Settings:Required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("Settings:Address")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("Settings:Phone")}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("Email")}>
            <Input type="email" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function GeneralSettingsTab() {
  const [form] = Form.useForm();
  const [language, setLanguage] = useLanguage();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      timezone: localStorage.getItem("bd_timezone") ?? "Asia/Ho_Chi_Minh",
      language,
      currency: localStorage.getItem("bd_currency") ?? "VND",
      dateFormat: localStorage.getItem("bd_dateFormat") ?? "DD/MM/YYYY",
    });
  }, [form, language]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    localStorage.setItem("bd_timezone", values.timezone);
    localStorage.setItem("bd_currency", values.currency);
    localStorage.setItem("bd_dateFormat", values.dateFormat);
    if (values.language !== language) {
      setLanguage(values.language as Language);
    }
    setSaved(true);
    toast.success(t("Settings:SaveSuccess"));
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {t("Settings:GeneralTitle")}
      </Title>
      <Form form={form} layout="vertical">
        <Form.Item name="timezone" label={t("Settings:Timezone")}>
          <Select options={TIMEZONE_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Form.Item>
        <Form.Item name="language" label={t("Settings:Language")}>
          <Select options={LANGUAGE_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Form.Item>
        <Form.Item name="currency" label={t("Settings:Currency")}>
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>
        <Form.Item name="dateFormat" label={t("Settings:DateFormat")}>
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} disabled={saved}>
            {t("Common:Save")}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

function PermissionsTab() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {t("Settings:PermissionsTitle")}
      </Title>
      <Text type="secondary">{t("Settings:PermissionsDesc")}</Text>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "var(--bd-blue)" }} />
          <Link onClick={() => navigate("/identity/users")}>{t("Settings:ManageUsers")}</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "var(--bd-blue)" }} />
          <Link onClick={() => navigate("/identity/roles")}>{t("Settings:ManageRoles")}</Link>
        </div>
      </div>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("Settings:PermissionsHint")}{" "}
        <Link onClick={() => navigate("/identity/roles")}>{t("Settings:ManageRoles")}</Link>.
      </Text>
    </div>
  );
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canPermissions =
    hasPermission(LegacyPermissions.SystemAdmin.Users) ||
    hasPermission(LegacyPermissions.SystemAdmin.Roles);

  const tabItems = useMemo(() => {
    const items: Array<{ key: string; label: string; children: React.ReactNode }> = [
      {
        key: "clinic",
        label: t("Settings:ClinicInfoTab"),
        children: (
          <div style={{ paddingBottom: 24 }}>
            <ClinicInfoTab />
          </div>
        ),
      },
      {
        key: "general",
        label: t("Settings:GeneralTab"),
        children: (
          <div style={{ paddingBottom: 24 }}>
            <GeneralSettingsTab />
          </div>
        ),
      },
    ];
    if (canPermissions) {
      items.push({
        key: "permissions",
        label: t("Settings:PermissionsTab"),
        children: (
          <div style={{ paddingBottom: 24 }}>
            <PermissionsTab />
          </div>
        ),
      });
    }
    return items;
  }, [canPermissions]);

  const activeTab = searchParams.get("tab") ?? "clinic";
  const safeTab = tabItems.some((t) => t.key === activeTab) ? activeTab : (tabItems[0]?.key ?? "clinic");

  return (
    <div>
      <PageHeader
        title={t("Settings:PageTitle")}
        subtitle={t("Settings:PageSubtitle")}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid var(--bd-line)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--bd-ink)" }}>
          {t("Settings:SystemSettings")}
        </h2>
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid var(--bd-line)",
          padding: "0 20px",
        }}
      >
        <PillTabs
          items={tabItems}
          activeKey={safeTab}
          onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
        />
      </div>
    </div>
  );
}
