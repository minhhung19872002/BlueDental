import { useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Breadcrumb,
  Drawer,
  Button,
  type MenuProps,
} from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  MenuOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { brand, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/theme/index";

const { Sider, Content } = Layout;

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Bảng điều khiển",
  reception: "Tiếp nhận khách hàng",
  patients: "Bệnh nhân",
  appointments: "Lịch hẹn",
  treatment: "Điều trị",
  billing: "Thanh toán",
  inventory: "Kho vật tư",
  reporting: "Báo cáo",
  notifications: "Thông báo",
  organizations: "Tổ chức",
  catalogs: "Danh mục",
  identity: "Tài khoản & quyền",
  "audit-logs": "Nhật ký hoạt động",
  settings: "Cấu hình hệ thống",
  administration: "Quản trị hệ thống",
  account: "Tài khoản",
  "change-password": "Đổi mật khẩu",
  profile: "Thông tin cá nhân",
};

function navIcon(glyph: string) {
  return (
    <span className="nav-icon" aria-hidden="true">
      {glyph}
    </span>
  );
}

const NAV_CONFIG = [
  {
    key: "overview",
    label: "Tổng quan",
    children: [
      { key: "/dashboard", icon: navIcon("📊"), label: "Bảng điều khiển" },
      { key: "/reception", icon: navIcon("📋"), label: "Tiếp nhận khách hàng" },
    ],
  },
  {
    key: "clinical",
    label: "Lâm sàng",
    children: [
      { key: "/patients", icon: navIcon("🦷"), label: "Bệnh nhân" },
      { key: "/appointments", icon: navIcon("📅"), label: "Lịch hẹn" },
      { key: "/treatment", icon: navIcon("💉"), label: "Điều trị" },
    ],
  },
  {
    key: "finance",
    label: "Tài chính",
    children: [
      { key: "/billing", icon: navIcon("💳"), label: "Thanh toán & Hóa đơn" },
      { key: "/inventory", icon: navIcon("📦"), label: "Kho vật tư" },
    ],
  },
  {
    key: "analytics",
    label: "Phân tích",
    children: [
      { key: "/reporting", icon: navIcon("📈"), label: "Báo cáo" },
    ],
  },
  {
    key: "system",
    label: "Quản trị hệ thống",
    children: [
      {
        key: "/administration/identity",
        icon: navIcon("🛡️"),
        label: "Tài khoản & quyền",
      },
      { key: "/organizations", icon: navIcon("🏥"), label: "Phòng khám" },
      { key: "/catalogs", icon: navIcon("🗃️"), label: "Danh mục" },
      {
        key: "/administration/audit-logs",
        icon: navIcon("📝"),
        label: "Nhật ký hoạt động",
      },
      {
        key: "/administration/settings",
        icon: navIcon("⚙️"),
        label: "Cấu hình hệ thống",
      },
    ],
  },
];

function buildMenuItems(): MenuProps["items"] {
  const result: NonNullable<MenuProps["items"]> = [];
  for (const group of NAV_CONFIG) {
    result.push({
      type: "group",
      key: group.key,
      label: group.label,
      children: group.children.map((child) => ({
        key: child.key,
        icon: child.icon,
        label: child.label,
      })),
    });
  }
  return result;
}

function initialsOf(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const items = [{ title: BREADCRUMB_LABELS[segments[0]] ?? "Trang chủ" }];
  if (segments.length > 1) {
    items.push({ title: BREADCRUMB_LABELS[segments[1]] ?? segments[1] });
  }
  return items;
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      navigate("/login", { replace: true });
    },
  });

  const menuItems = useMemo(() => buildMenuItems(), []);
  const breadcrumbItems = useMemo(
    () => buildBreadcrumbs(location.pathname),
    [location.pathname],
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
    setMobileOpen(false);
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      label: user?.clinicName ?? "Toàn hệ thống",
      disabled: true,
      style: { color: "rgba(0,0,0,0.45)", fontSize: 12 },
    },
    { type: "divider" },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Thông tin cá nhân",
      onClick: () => navigate("/account/profile"),
    },
    {
      key: "change-password",
      icon: <KeyOutlined />,
      label: "Đổi mật khẩu",
      onClick: () => navigate("/account/change-password"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: () => logoutMutation.mutate(),
    },
  ];

  const sidebarContent = (
    <>
      <Link
        to="/dashboard"
        className="sidebar-logo"
        aria-label="Về trang chủ"
        onClick={() => setMobileOpen(false)}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: brand.blue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          BD
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">BlueDental</span>
          <span className="sidebar-logo-subtitle">Quản lý Phòng khám Nha</span>
        </div>
      </Link>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0, paddingTop: 8 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={SIDEBAR_WIDTH}
        collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
        className={collapsed ? "sidebar-collapsed" : ""}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
        style={{
          overflow: "auto",
          height: "100vh",
          position: "sticky",
          top: 0,
          left: 0,
        }}
        trigger={null}
      >
        {sidebarContent}
      </Sider>

      <Drawer
        placement="left"
        width={SIDEBAR_WIDTH}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        styles={{ body: { padding: 0, background: brand.ink } }}
        closable={false}
      >
        {sidebarContent}
      </Drawer>

      <Layout>
        <header className="app-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => {
                if (window.innerWidth < 992) {
                  setMobileOpen(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              style={{ fontSize: 16, width: 32, height: 32 }}
            />
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="app-header-actions">
            <NotificationBell />

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="app-header-user">
                <Avatar
                  size={32}
                  style={{
                    backgroundColor: brand.blue,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {initialsOf(user?.name)}
                </Avatar>
                <div className="app-header-user-text">
                  <span className="app-header-user-name">
                    {user?.name ?? "Người dùng"}
                  </span>
                  <span className="app-header-user-org">
                    {user?.clinicName ?? "Toàn hệ thống"}
                  </span>
                </div>
                <DownOutlined
                  style={{ fontSize: 10, color: brand.muted, flexShrink: 0 }}
                />
              </div>
            </Dropdown>
          </div>
        </header>

        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>

        <footer className="app-footer">
          BlueDental v1.0 — Phần mềm quản lý Phòng khám Nha khoa
        </footer>
      </Layout>
    </Layout>
  );
}
