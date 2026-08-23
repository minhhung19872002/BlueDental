import { useEffect, useState } from "react";
import { Button, Descriptions, Divider, Form, Input, Modal, Select, Spin, Tabs, Typography, message } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { EditOutlined, UserOutlined } from "@ant-design/icons";
import { useClinicInfo, useUpdateClinicInfo, type UpdateClinicInfoDto } from "../api";

const { Title, Text, Link } = Typography;

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (UTC+7) — TP.HCM / Ha Noi" },
  { value: "Asia/Bangkok", label: "Indochina Time (UTC+7) — Bangkok" },
  { value: "UTC", label: "UTC+0" },
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tieng Viet" },
  { value: "en", label: "English" },
];

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND" },
  { value: "USD", label: "USD" },
];

function ClinicInfoTab() {
  const { t } = useTranslation();
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
    message.success(t("settings.updateSuccess"));
    setEditOpen(false);
  };

  if (isLoading) {
    return <Spin style={{ display: "block", marginTop: 40 }} />;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          {t("settings.clinicInfoTitle")}
        </Title>
        <Button icon={<EditOutlined />} onClick={openEdit}>
          {t("common.edit")}
        </Button>
      </div>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label={t("settings.clinicName")}>
          <Text>{clinic?.name ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicAddress")}>
          <Text>{clinic?.address ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicPhone")}>
          <Text>{clinic?.phoneNumber ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicEmail")}>
          <Text>{clinic?.email ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("settings.clinicCode")}>
          <Text>{clinic?.code ?? "—"}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Modal
        open={editOpen}
        title={t("settings.editClinicInfo")}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        confirmLoading={updateMutation.isPending}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("settings.clinicName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("settings.clinicAddress")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("settings.clinicPhone")}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("settings.clinicEmail")}>
            <Input type="email" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function GeneralSettingsTab() {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      timezone: localStorage.getItem("bd_timezone") ?? "Asia/Ho_Chi_Minh",
      language: i18n.language ?? "vi",
      currency: localStorage.getItem("bd_currency") ?? "VND",
      dateFormat: localStorage.getItem("bd_dateFormat") ?? "DD/MM/YYYY",
    });
  }, [form, i18n.language]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    localStorage.setItem("bd_timezone", values.timezone);
    localStorage.setItem("bd_currency", values.currency);
    localStorage.setItem("bd_dateFormat", values.dateFormat);
    if (values.language !== i18n.language) {
      i18n.changeLanguage(values.language);
    }
    setSaved(true);
    message.success(t("settings.saveSuccess"));
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {t("settings.generalTitle")}
      </Title>
      <Form form={form} layout="vertical">
        <Form.Item name="timezone" label={t("settings.timezone")}>
          <Select options={TIMEZONE_OPTIONS} />
        </Form.Item>
        <Form.Item name="language" label={t("settings.defaultLanguage")}>
          <Select options={LANGUAGE_OPTIONS} />
        </Form.Item>
        <Form.Item name="currency" label={t("settings.currency")}>
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>
        <Form.Item name="dateFormat" label={t("settings.dateFormat")}>
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} disabled={saved}>
            {t("common.save")}
          </Button>
        </Form.Item>
      </Form>
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
      <Text type="secondary">{t("settings.permissionsDesc")}</Text>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/users")}>{t("settings.manageUsers")}</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/roles")}>{t("settings.manageRoles")}</Link>
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
