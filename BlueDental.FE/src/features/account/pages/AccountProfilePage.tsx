import { toast } from "sonner";
import { Card, Avatar, Button, Input, Row, Col, Typography, Divider } from "antd";
import { UserOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useUpdateProfile } from "@/features/account/api/accountMutations";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";

const { Text, Title } = Typography;

export function AccountProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const updateProfile = useUpdateProfile();

  const handleSave = () => {
    if (!user) return;
    updateProfile.mutate(
      { name, email },
      {
        onSuccess: (data) => {
          setAuth({ ...user, name: data.name ?? name, email: data.email ?? email });
          toast.success(t("Cập nhật thông tin thành công!"));
          setEditing(false);
        },
      },
    );
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t("Thông tin tài khoản")}
        subtitle={t("Quản lý thông tin cá nhân của bạn")}
      />

      <Row gutter={[20, 20]}>
        {/* Avatar card */}
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Avatar
                size={96}
                src={user?.clinicLogoUrl ?? undefined}
                icon={<UserOutlined />}
                style={{ marginBottom: 16, background: "var(--bd-blue)" }}
              />
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>{user?.name}</Title>
                <Text type="secondary">{user?.roles?.[0] ?? "Admin"}</Text>
              </div>
              <div style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: "var(--bd-faint)" }}>{user?.clinicName}</Text>
              </div>
              <Button
                icon={<EditOutlined />}
                style={{ marginTop: 16 }}
                onClick={() => setEditing(true)}
              >
                {t("Đổi ảnh đại diện")}
              </Button>
            </div>
          </Card>
        </Col>

        {/* Profile info card */}
        <Col xs={24} lg={16}>
          <Card
            title={t("Thông tin cá nhân")}
            extra={
              editing ? (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={updateProfile.isPending}
                  style={{ background: "var(--bd-blue)" }}
                >
                  {t("Lưu thay đổi")}
                </Button>
              ) : (
                <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                  {t("Chỉnh sửa")}
                </Button>
              )
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "var(--bd-muted)", fontWeight: 500 }}>{t("Họ và tên")}</Text>
                </div>
                {editing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} style={{ height: 40 }} />
                ) : (
                  <Text strong>{user?.name ?? "—"}</Text>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "var(--bd-muted)", fontWeight: 500 }}>{t("Email")}</Text>
                </div>
                {editing ? (
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} style={{ height: 40 }} />
                ) : (
                  <Text>{user?.email ?? "—"}</Text>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "var(--bd-muted)", fontWeight: 500 }}>{t("Vai trò")}</Text>
                </div>
                <Text>{user?.roles?.[0] ?? "—"}</Text>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "var(--bd-muted)", fontWeight: 500 }}>{t("Chi nhánh")}</Text>
                </div>
                <Text>{user?.clinicName ?? "—"}</Text>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "var(--bd-muted)", fontWeight: 500 }}>{t("ID tài khoản")}</Text>
                </div>
                <Text style={{ fontFamily: "monospace", fontSize: 12, color: "var(--bd-muted)" }}>{user?.id ?? "—"}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
