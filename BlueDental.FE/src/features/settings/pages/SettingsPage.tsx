import { Descriptions, Divider, Form, Input, Select, Tabs, Typography } from "antd";
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
  return (
    <div style={{ maxWidth: 640 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        Thông tin phòng khám
      </Title>
      <Descriptions bordered column={1} size="middle">
        <Descriptions.Item label="Tên phòng khám">
          <Text>BlueDental Clinic</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Địa chỉ">
          <Text>123 Đường Lê Lợi, Quận 1, TP.HCM</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Số điện thoại">
          <Text>028 1234 5678</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          <Text>contact@bluedental.vn</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Tagline">
          <Text>Nụ cười khỏe mạnh — Cuộc sống tươi vui</Text>
        </Descriptions.Item>
        <Descriptions.Item label="URL Logo">
          <Text type="secondary">(Chưa cấu hình)</Text>
        </Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          * Liên hệ quản trị hệ thống để cập nhật thông tin phòng khám.
        </Text>
      </div>
    </div>
  );
}

function GeneralSettingsTab() {
  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        Cài đặt chung
      </Title>
      <Form layout="vertical" disabled>
        <Form.Item label="Múi giờ" initialValue="Asia/Ho_Chi_Minh">
          <Select
            options={TIMEZONE_OPTIONS}
            defaultValue="Asia/Ho_Chi_Minh"
          />
        </Form.Item>
        <Form.Item label="Ngôn ngữ mặc định" initialValue="vi">
          <Select
            options={LANGUAGE_OPTIONS}
            defaultValue="vi"
          />
        </Form.Item>
        <Form.Item label="Đơn vị tiền tệ" initialValue="VND">
          <Select
            options={CURRENCY_OPTIONS}
            defaultValue="VND"
          />
        </Form.Item>
        <Form.Item label="Định dạng ngày tháng">
          <Input defaultValue="DD/MM/YYYY" />
        </Form.Item>
      </Form>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        * Cài đặt chung hiện được quản lý tập trung. Liên hệ quản trị viên để thay đổi.
      </Text>
    </div>
  );
}

function PermissionsTab() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        Phân quyền người dùng & vai trò
      </Title>
      <Text type="secondary">
        Quản lý tài khoản người dùng và vai trò được thực hiện qua module Identity.
      </Text>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/users")}>
            Quản lý người dùng
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          <Link onClick={() => navigate("/identity/roles")}>
            Quản lý vai trò & quyền
          </Link>
        </div>
      </div>
      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        * Để phân quyền chi tiết cho từng chức năng, vào{" "}
        <Link onClick={() => navigate("/identity/roles")}>Quản lý vai trò</Link>{" "}
        và chỉnh sửa quyền tương ứng.
      </Text>
    </div>
  );
}

export function SettingsPage() {
  const tabItems = [
    {
      key: "clinic",
      label: "Thông tin phòng khám",
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <ClinicInfoTab />
        </div>
      ),
    },
    {
      key: "general",
      label: "Cài đặt chung",
      children: (
        <div style={{ paddingTop: 16, paddingBottom: 24 }}>
          <GeneralSettingsTab />
        </div>
      ),
    },
    {
      key: "permissions",
      label: "Phân quyền",
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
          Cài đặt hệ thống
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
