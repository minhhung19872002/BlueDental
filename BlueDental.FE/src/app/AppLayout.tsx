import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Avatar,
  Dropdown,
  Input,
  Popover,
  type MenuProps,
} from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  DownOutlined,
  BellOutlined,
  GlobalOutlined,
  SearchOutlined,
  ScheduleOutlined,
  TeamOutlined,
  CalendarOutlined,
  CustomerServiceOutlined,
  ExperimentOutlined,
  SettingOutlined,
  BarChartOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  AppstoreOutlined,
  ToolOutlined,
  QuestionCircleOutlined,
  CheckOutlined,
  HeartOutlined,
} from "@ant-design/icons";
import { useLanguage, useT } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { brand, SIDEBAR_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "@/theme/index";

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}

/** Translator type, so the builders below stay readable. */
type Translate = (vietnamese: string) => string;

// The navigation is built per render: its labels follow the chosen language.
const mainNav = (t: Translate): NavItem[] => [
  { key: "/reception", icon: <ScheduleOutlined />, label: t("Tiếp nhận") },
  { key: "/patient", icon: <TeamOutlined />, label: t("Danh sách bệnh nhân") },
  { key: "/calendar", icon: <CalendarOutlined />, label: t("Lịch hẹn") },
  { key: "/cskh-grouping", icon: <CustomerServiceOutlined />, label: t("CSKH - Phân nhóm") },
  { key: "/labo", icon: <ExperimentOutlined />, label: t("Labo") },
  { key: "/operations", icon: <SettingOutlined />, label: t("Quản trị vận hành") },
  { key: "/report", icon: <BarChartOutlined />, label: t("Báo cáo") },
  { key: "/staff", icon: <IdcardOutlined />, label: t("Nhân viên") },
  { key: "/materials", icon: <MedicineBoxOutlined />, label: t("Vật tư") },
  { key: "/taxonomy", icon: <AppstoreOutlined />, label: t("Danh mục") },
  { key: "/tools", icon: <ToolOutlined />, label: t("Công cụ") },
];

const bottomNav = (t: Translate): NavItem[] => [
  {
    key: "https://nfcdental.com/",
    icon: <QuestionCircleOutlined />,
    label: t("Hướng dẫn & hỗ trợ"),
    external: true,
  },
];

const searchCategories = (t: Translate) => [
  {
    icon: <UserOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: t("Khách hàng"),
    desc: t("Tìm theo tên, mã KH, số điện thoại"),
  },
  {
    icon: <CalendarOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: t("Lịch hẹn"),
    desc: t("Tìm theo tên hoặc SĐT khách hàng"),
  },
  {
    icon: <HeartOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: t("CSKH"),
    desc: t("Tìm theo khách hàng, nội dung"),
  },
  {
    icon: <IdcardOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: t("Nhân viên"),
    desc: t("Tìm theo tên, email, số điện thoại"),
  },
];

function initialsOf(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function SidebarNavItem({
  item,
  active,
  expanded,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  if (expanded) {
    return (
      <button
        type="button"
        title={item.label}
        onClick={onClick}
        className={`sidebar-nav-item sidebar-nav-item--expanded ${active ? "sidebar-nav-item--active" : ""}`}
      >
        <span className="sidebar-nav-icon">{item.icon}</span>
        <span className="sidebar-nav-label-expanded">{item.label}</span>
      </button>
    );
  }

  // Collapsed, the design shows the icon alone — the rail is too narrow for a
  // label, and a clipped one reads worse than none. The title carries the name.
  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      onClick={onClick}
      className={`sidebar-nav-item sidebar-nav-item--collapsed ${active ? "sidebar-nav-item--active" : ""}`}
    >
      <span className="sidebar-nav-icon">{item.icon}</span>
    </button>
  );
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [language, setLanguage] = useLanguage();
  const t = useT();
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    },
    [searchOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleNavClick = (item: NavItem) => {
    if (item.external) {
      window.open(item.key, "_blank", "noopener");
    } else {
      navigate(item.key);
    }
  };

  const isActive = (key: string) => {
    if (key === "/reception") return location.pathname === "/reception";
    return location.pathname.startsWith(key);
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      label: user?.clinicName ?? "BlueDental",
      disabled: true,
      style: { color: "rgba(0,0,0,0.45)", fontSize: 12 },
    },
    { type: "divider" },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: t("Thông tin cá nhân"),
      onClick: () => navigate("/account/profile"),
    },
    {
      key: "change-password",
      icon: <KeyOutlined />,
      label: t("Đổi mật khẩu"),
      onClick: () => navigate("/account/change-password"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("Đăng xuất"),
      danger: true,
      onClick: () => logoutMutation.mutate(),
    },
  ];

  const clinicName = user?.clinicName ?? "NHA KHOA ĐỨC HẠNH PREMIUM";
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo_app.jpg";
  const clinicTagline = user?.clinicTagline ?? "Kiến Tạo Nụ Cười - Giá Trị Bền Vững";
  const sidebarWidth = sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_WIDTH;

  const branchContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">{t("Chi nhánh")}</div>
      <button type="button" className="app-popover-item">
        <span className="app-popover-dot" style={{ background: brand.faint }} />
        <span>{t("Tất cả chi nhánh")}</span>
      </button>
      <button type="button" className="app-popover-item app-popover-item--active">
        <span className="app-popover-dot" style={{ background: "#25a97a" }} />
        <span>{clinicName}</span>
      </button>
    </div>
  );

  const langContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">{t("Ngôn ngữ")}</div>
      <button type="button" className="app-popover-item" onClick={() => setLanguage("vi")}>
        <span>{t("Tiếng Việt")}</span>
        {language === "vi" && <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />}
      </button>
      <button type="button" className="app-popover-item" onClick={() => setLanguage("en")}>
        <span>English</span>
        {language === "en" && <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa" }}>
      {/* ── Sidebar ── */}
      <aside className="app-sidebar" style={{ width: sidebarWidth }}>
        {/* Logo area */}
        <div className={`sidebar-logo-area ${!sidebarExpanded ? "sidebar-logo-area--collapsed" : ""}`}>
          <div className="sidebar-logo-img-wrap">
            <img
              src={clinicLogoUrl}
              alt={clinicName}
              className="sidebar-logo-img"
            />
          </div>
          {sidebarExpanded && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">BlueDental</span>
              <span className="sidebar-logo-sub">{t("Quản trị vận hành")}</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav-main">
          {sidebarExpanded && <div className="sidebar-nav-section">MENU</div>}
          {mainNav(t).map((item) => (
            <SidebarNavItem
              key={item.key}
              item={item}
              active={isActive(item.key)}
              expanded={sidebarExpanded}
              onClick={() => handleNavClick(item)}
            />
          ))}
        </nav>

        {/* Bottom nav */}
        <nav className="sidebar-nav-bottom">
          {bottomNav(t).map((item) => (
            <SidebarNavItem
              key={item.key}
              item={item}
              active={false}
              expanded={sidebarExpanded}
              onClick={() => handleNavClick(item)}
            />
          ))}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div
        className="app-main"
        style={{ marginLeft: sidebarWidth, transition: "margin-left 0.2s" }}
      >
        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-header-left">
            <button
              type="button"
              className="app-header-toggle"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              title={sidebarExpanded ? t("Thu gọn menu") : t("Mở rộng menu")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                {sidebarExpanded ? (
                  <path d="M15 9l-3 3 3 3" />
                ) : (
                  <path d="M13 9l3 3-3 3" />
                )}
              </svg>
            </button>

            <div className="app-header-clinic">
              <div className="app-header-clinic-logo">
                <img
                  src={clinicLogoUrl}
                  alt={clinicName}
                  className="app-header-clinic-logo-img"
                />
              </div>
              <div className="app-header-clinic-text">
                <p className="app-header-clinic-name">{clinicName}</p>
                <p className="app-header-clinic-tagline">{clinicTagline}</p>
              </div>
            </div>
          </div>

          <div className="app-header-right">
            <button
              type="button"
              className="app-header-search"
              onClick={() => setSearchOpen(true)}
            >
              <SearchOutlined style={{ fontSize: 16 }} />
              <span className="app-header-search-text">
                {t("Tìm kiếm khách hàng, lịch hẹn, nhân viên…")}
              </span>
              <kbd className="app-header-search-kbd">Ctrl K</kbd>
            </button>

            <Popover content={branchContent} trigger="click" placement="bottomRight" arrow={false}>
              <button type="button" className="app-header-branch">
                <span className="app-header-branch-dot" />
                <span className="app-header-branch-name">{clinicName}</span>
                <DownOutlined style={{ fontSize: 14, color: "#6f7c90" }} />
              </button>
            </Popover>

            <div className="app-header-actions">
              <Popover content={langContent} trigger="click" placement="bottomRight" arrow={false}>
                <button type="button" className="app-header-icon-btn" aria-label={t("Ngôn ngữ")}>
                  <GlobalOutlined style={{ fontSize: 18 }} />
                </button>
              </Popover>

              <button type="button" className="app-header-icon-btn" aria-label={t("Thông báo")}>
                <BellOutlined style={{ fontSize: 18 }} />
                <span className="app-header-notif-dot" />
              </button>

              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div className="app-header-user" role="button" tabIndex={0} aria-label={t("Tài khoản người dùng")}>
                  <Avatar
                    size={32}
                    style={{ backgroundColor: brand.blue, fontSize: 13, fontWeight: 700 }}
                  >
                    {initialsOf(user?.name)}
                  </Avatar>
                  <span className="app-header-user-name">{user?.name ?? "Admin"}</span>
                  <DownOutlined style={{ fontSize: 14, color: "#6f7c90" }} />
                </div>
              </Dropdown>
            </div>
          </div>
        </header>

        <main style={{ padding: 16, minHeight: 280 }}>
          <Outlet />
        </main>
      </div>

      {/* ── Global search modal ── */}
      {searchOpen && (
        <div className="app-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="app-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-search-input-row">
              <Input
                autoFocus
                size="large"
                prefix={<SearchOutlined />}
                placeholder={t("Tìm kiếm khách hàng, lịch hẹn, nhân viên…")}
                onPressEnter={() => setSearchOpen(false)}
                style={{ borderRadius: 12 }}
              />
              <kbd className="app-search-esc" onClick={() => setSearchOpen(false)}>Esc</kbd>
            </div>
            <div className="app-search-categories">
              <div className="app-search-categories-title">{t("Gợi ý tìm kiếm")}</div>
              {searchCategories(t).map((cat) => (
                <div key={cat.title} className="app-search-category-item">
                  <span className="app-search-category-icon">{cat.icon}</span>
                  <div className="app-search-category-text">
                    <span className="app-search-category-name">{cat.title}</span>
                    <span className="app-search-category-desc">{cat.desc}</span>
                  </div>
                </div>
              ))}
              <div className="app-search-hint">{t("Nhập ít nhất 2 ký tự để tìm kiếm.")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
