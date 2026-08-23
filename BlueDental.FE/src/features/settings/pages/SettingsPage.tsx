import { Descriptions, Divider, Form, Input, Select, Tabs, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserOutlined } from "@ant-design/icons";

const { Title, Text, Link } = Typography;

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (UTC+7) — TP.HCM / Hà Nội" },
  { value: "Asia/Bangkok",     label: "Indochina Time (UTC+7) — Bangkok" },
  { value: "UTC",              label: "UTC+0" },
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND — Đồng Việt Nam" },
  { value: "USD", label: "USD — US Dollar" },
];

function ClinicInfoTab() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 640 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {t("settings.clinicInfoTitle")}
      </Title>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label={t("settings.clinicName")}>
          <Text>BlueDental Clinic</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicAddress")}>
          <Text>123 Đường Lê Lợi, Quận 1, TP.HCM</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicPhone")}>
          <Text>028 1234 5678</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicEmail")}>
          <Text>contact@bluedental.vn</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicTagline")}>
          <Text>Nụ cười khỏe mạnh — Cuộc sống tươi vui</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicLogo")}>
          <Text type="secondary">{t("settings.notConfigured")}</Text>
        </Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t("settings.contactAdmin")}
        </Text>
      </div>
    </div>
  );
}

function GeneralSettingsTab() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {t("settings.generalTitle")}
      </Title>
      <Form layout="vertical" disabled>
        <Form.Item label={t("settings.timezone")} initialValue="Asia/Ho_Chi_Minh">
          <Select
            options={TIMEZONE_OPTIONS}
            defaultValue="Asia/Ho_Chi_Minh"
          />
        </Form.Item>
        <Form.Item label={t("settings.defaultLanguage")} initialValue="vi">
          <Select
            options={LANGUAGE_OPTIONS}
            defaultValue="vi"
          />
        </Form.Item>
        <Form.Item label={t("settings.currency")} initialValue="VND">
          <Select
            options={CURRENCY_OPTIONS}
            defaultValue="VND"
          />
        </Form.Item>
        <Form.Item label={t("settings.dateFormat")}>
          <Input defaultValue="DD/MM/YYYY" />
        </Form.Item>
      </Form>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("settings.generalNote")}
      </Text>
    </div>
  );
}

function PermissionsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {t("settings.permissionsTitle")}
      </Title>
      <Text type="secondary">
        {t("settings.permissionsDesc")}
      </Text>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/users")}>
            {t("settings.manageUsers")}
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/roles")}>
            {t("settings.manageRoles")}
          </Link>
        </div>
      </div>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("settings.permissionsNote")}{" "}
        <Link onClick={() => navigate("/identity/roles")}>{t("settings.manageRoles")}</Link>.
      </Text>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const tabItems = [
    {
      key: "clinic",
      label: t("settings.clinicInfo"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <ClinicInfoTab />
        </div>
      ),
    },
    {
      key: "general",
      label: t("settings.general"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <GeneralSettingsTab />
        </div>
      ),
    },
    {
      key: "permissions",
      label: t("settings.permissions"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <PermissionsTab />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #E5E7EB",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          {t("settings.title")}
        </h2>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        <Tabs items={tabItems} />
      </div>
    </div>
  );
}
