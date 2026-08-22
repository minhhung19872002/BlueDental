import { Card, Avatar, Button, Input, Row, Col, Typography, Divider, message } from "antd";
import { UserOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";

const { Text, Title } = Typography;

export function AccountProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const handleSave = () => {
    message.success("Cập nhật thông tin thành công!");
    setEditing(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Title level={4} style={{ margin: 0 }}>Thông tin tài khoản</Title>
          <Text type="secondary">Quản lý thông tin cá nhân của bạn</Text>
        </div>
      </div>

      <Row gutter={[20, 20]}>
        {/* Avatar card */}
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Avatar
                size={96}
                src={user?.clinicLogoUrl ?? undefined}
                icon={<UserOutlined />}
                style={{ marginBottom: 16, background: "#2671D8" }}
              />
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>{user?.name}</Title>
                <Text type="secondary">{user?.roles?.[0] ?? "Admin"}</Text>
              </div>
              <div style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>{user?.clinicName}</Text>
              </div>
              <Button
                icon={<EditOutlined />}
                style={{ marginTop: 16 }}
                onClick={() => setEditing(true)}
              >
                Đổi ảnh đại diện
              </Button>
            </div>
          </Card>
        </Col>

        {/* Profile info card */}
        <Col xs={24} lg={16}>
          <Card
            title="Thông tin cá nhân"
            extra={
              editing ? (
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ background: "#2671D8" }}>
                  Lưu thay đổi
                </Button>
              ) : (
                <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                  Chỉnh sửa
                </Button>
              )
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#5A6B82", fontWeight: 500 }}>Họ và tên</Text>
                </div>
                {editing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} style={{ height: 40 }} />
                ) : (
                  <Text strong>{user?.name ?? "—"}</Text>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#5A6B82", fontWeight: 500 }}>Email</Text>
                </div>
                {editing ? (
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} style={{ height: 40 }} />
                ) : (
                  <Text>{user?.email ?? "—"}</Text>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#5A6B82", fontWeight: 500 }}>Vai trò</Text>
                </div>
                <Text>{user?.roles?.[0] ?? "—"}</Text>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#5A6B82", fontWeight: 500 }}>Chi nhánh</Text>
                </div>
                <Text>{user?.clinicName ?? "—"}</Text>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#5A6B82", fontWeight: 500 }}>ID tài khoản</Text>
                </div>
                <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#6B7280" }}>{user?.id ?? "—"}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
