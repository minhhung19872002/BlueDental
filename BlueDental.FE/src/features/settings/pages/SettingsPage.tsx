import { useEffect, useState } from "react";
import { Button, Descriptions, Divider, Form, Input, Modal, Select, Spin, Tabs, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { EditOutlined, UserOutlined } from "@ant-design/icons";
import { useClinicInfo, useUpdateClinicInfo, type UpdateClinicInfoDto } from "../api";
import { t, useLanguage, type Language } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

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
    message.success(t("Cập nhật thông tin thành công"));
    setEditOpen(false);
  };

  if (isLoading) {
    return <Spin style={{ display: "block", marginTop: 40 }} />;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          {t("Thông tin phòng khám")}
        </Title>
        <Button icon={<EditOutlined />} onClick={openEdit}>
          {t("Chỉnh sửa")}
        </Button>
      </div>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label={t("Tên phòng khám")}>
          <Text>{clinic?.name ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Địa chỉ")}>
          <Text>{clinic?.address ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Số điện thoại")}>
          <Text>{clinic?.phoneNumber ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Email")}>
          <Text>{clinic?.email ?? "—"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("Mã chi nhánh")}>
          <Text>{clinic?.code ?? "—"}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Modal
        open={editOpen}
        title={t("Sửa thông tin phòng khám")}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        confirmLoading={updateMutation.isPending}
        okText={t("Lưu")}
        cancelText={t("Hủy")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("Tên phòng khám")}
            rules={[{ required: true, message: t("Bắt buộc") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t("Địa chỉ")}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label={t("Số điện thoại")}>
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
    message.success(t("Lưu cài đặt thành công"));
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {t("Cài đặt chung")}
      </Title>
      <Form form={form} layout="vertical">
        <Form.Item name="timezone" label={t("Múi giờ")}>
          <Select options={TIMEZONE_OPTIONS} />
        </Form.Item>
        <Form.Item name="language" label={t("Ngôn ngữ mặc định")}>
          <Select options={LANGUAGE_OPTIONS} />
        </Form.Item>
        <Form.Item name="currency" label={t("Đơn vị tiền tệ")}>
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>
        <Form.Item name="dateFormat" label={t("Định dạng ngày tháng")}>
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} disabled={saved}>
            {t("Lưu")}
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
        {t("Phân quyền người dùng & vai trò")}
      </Title>
      <Text type="secondary">{t("Quản lý tài khoản người dùng và vai trò được thực hiện qua module Identity.")}</Text>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/users")}>{t("Quản lý người dùng")}</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/roles")}>{t("Quản lý vai trò & quyền")}</Link>
        </div>
      </div>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("* Để phân quyền chi tiết cho từng chức năng, vào")}{" "}
        <Link onClick={() => navigate("/identity/roles")}>{t("Quản lý vai trò & quyền")}</Link>.
      </Text>
    </div>
  );
}

export function SettingsPage() {
  const tabItems = [
    {
      key: "clinic",
      label: t("Thông tin phòng khám"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <ClinicInfoTab />
        </div>
      ),
    },
    {
      key: "general",
      label: t("Cài đặt chung"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <GeneralSettingsTab />
        </div>
      ),
    },
    {
      key: "permissions",
      label: t("Phân quyền"),
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <PermissionsTab />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("Cài đặt")}
        subtitle={t("Tuỳ chọn hiển thị và cấu hình chung")}
      />

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
          {t("Cài đặt hệ thống")}
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
