import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Avatar,
  Badge,
  Dropdown,
  Input,
  List,
  Popover,
  type MenuProps,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { useTranslation } from "react-i18next";
import { useMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/notifications/api";
dayjs.extend(relativeTime);
dayjs.locale("vi");
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
  SafetyCertificateOutlined,
  AuditOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  ControlOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { brand } from "@/theme/index";

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  labelKey?: string;
  external?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { key: "/reception", icon: <ScheduleOutlined />, label: "Tiếp nhận", labelKey: "nav.reception" },
  { key: "/patient", icon: <TeamOutlined />, label: "Danh sách bệnh nhân", labelKey: "nav.patientList" },
  { key: "/calendar", icon: <CalendarOutlined />, label: "Lịch hẹn", labelKey: "nav.calendar" },
  { key: "/cskh-grouping", icon: <CustomerServiceOutlined />, label: "CSKH - Phân nhóm", labelKey: "nav.cskh" },
  { key: "/labo", icon: <ExperimentOutlined />, label: "Labo", labelKey: "nav.labo" },
  { key: "/operations", icon: <SettingOutlined />, label: "Quản trị vận hành", labelKey: "nav.operations" },
  { key: "/report", icon: <BarChartOutlined />, label: "Báo cáo", labelKey: "nav.report" },
  { key: "/staff", icon: <IdcardOutlined />, label: "Nhân viên", labelKey: "nav.staff" },
  { key: "/timekeeping", icon: <ClockCircleOutlined />, label: "Chấm công", labelKey: "nav.timekeeping" },
  { key: "/materials", icon: <MedicineBoxOutlined />, label: "Vật tư", labelKey: "nav.materials" },
  { key: "/billing", icon: <DollarOutlined />, label: "Thanh toán", labelKey: "nav.billing" },
  { key: "/taxonomy", icon: <AppstoreOutlined />, label: "Danh mục", labelKey: "nav.taxonomy" },
  { key: "/tools", icon: <ToolOutlined />, label: "Công cụ", labelKey: "nav.tools" },
  { key: "/settings", icon: <ControlOutlined />, label: "Cài đặt", labelKey: "nav.settings" },
  { key: "/identity", icon: <SafetyCertificateOutlined />, label: "Người dùng & vai trò", labelKey: "nav.identity" },
  { key: "/audit-logs", icon: <AuditOutlined />, label: "Nhật ký hoạt động", labelKey: "nav.auditLogs" },
  { key: "/organizations", icon: <BankOutlined />, label: "Chi nhánh", labelKey: "nav.organizations" },
];

const BOTTOM_NAV: NavItem[] = [
  {
    key: "https://nfcdental.com/",
    icon: <QuestionCircleOutlined />,
    label: "Hướng dẫn & hỗ trợ",
    labelKey: "nav.help",
    external: true,
  },
];

const SEARCH_CATEGORIES = [
  {
    icon: <UserOutlined style={{ fontSize: 18, color: brand.muted }} />,
    titleKey: "searchCategory.customer",
    descKey: "searchCategory.customerDesc",
  },
  {
    icon: <CalendarOutlined style={{ fontSize: 18, color: brand.muted }} />,
    titleKey: "searchCategory.appointment",
    descKey: "searchCategory.appointmentDesc",
  },
  {
    icon: <HeartOutlined style={{ fontSize: 18, color: brand.muted }} />,
    titleKey: "searchCategory.cskh",
    descKey: "searchCategory.cskhDesc",
  },
  {
    icon: <IdcardOutlined style={{ fontSize: 18, color: brand.muted }} />,
    titleKey: "searchCategory.staff",
    descKey: "searchCategory.staffDesc",
  },
];

function initialsOf(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function NotificationBell() {
  const { t } = useTranslation();
  const { data } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const content = (
    <div style={{ width: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #F0F0F0" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t("header.notification")}</span>
        {unreadCount > 0 && (
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#1677ff", cursor: "pointer", fontSize: 12 }}
            onClick={() => markAllRead.mutate()}
          >
            {t("header.markAllRead")}
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          {t("header.noNotifications")}
        </div>
      ) : (
        <List
          size="small"
          dataSource={notifications}
          renderItem={(notif) => (
            <List.Item
              style={{ padding: "8px 12px", background: notif.isRead ? "#fff" : "#F0F7FF", cursor: "pointer" }}
              onClick={() => { if (!notif.isRead) markRead.mutate(notif.id); }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#1B2A41", lineHeight: 1.4 }}>{notif.message}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {dayjs(notif.creationTime).fromNow()}
                </div>
              </div>
              {!notif.isRead && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1677ff", flexShrink: 0 }} />}
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false}>
      <button type="button" className="app-header-icon-btn" aria-label={t("header.notification")}>
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      </button>
    </Popover>
  );
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
  const { t } = useTranslation();
  const label = item.labelKey ? t(item.labelKey) : item.label;
  if (expanded) {
    return (
      <button
        type="button"
        title={label}
        onClick={onClick}
        className={`sidebar-nav-item sidebar-nav-item--expanded ${active ? "sidebar-nav-item--active" : ""}`}
      >
        <span className="sidebar-nav-icon">{item.icon}</span>
        <span className="sidebar-nav-label-expanded">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`sidebar-nav-item sidebar-nav-item--collapsed ${active ? "sidebar-nav-item--active" : ""}`}
    >
      <span className="sidebar-nav-icon">{item.icon}</span>
      <span className="sidebar-nav-label-collapsed">{label}</span>
    </button>
  );
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language === "en" ? "en" : "vi";
  const setCurrentLang = (lng: string) => { i18n.changeLanguage(lng); };
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
      label: t("header.profile"),
      onClick: () => navigate("/account/profile"),
    },
    {
      key: "change-password",
      icon: <KeyOutlined />,
      label: t("header.changePassword"),
      onClick: () => navigate("/account/change-password"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("header.logout"),
      danger: true,
      onClick: () => logoutMutation.mutate(),
    },
  ];

  const clinicName = user?.clinicName ?? "NHA KHOA ĐỨC HẠNH PREMIUM";
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo_app.jpg";
  const clinicTagline = user?.clinicTagline ?? "Kiến Tạo Nụ Cười - Giá Trị Bền Vững";
  const sidebarWidth = sidebarExpanded ? 248 : 110;

  const branchContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">{t("header.branch")}</div>
      <button type="button" className="app-popover-item">
        <span className="app-popover-dot" style={{ background: brand.faint }} />
        <span>{t("header.allBranches")}</span>
      </button>
      <button type="button" className="app-popover-item app-popover-item--active">
        <span className="app-popover-dot" style={{ background: "#2BB673" }} />
        <span>{clinicName}</span>
      </button>
    </div>
  );

  const langContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">{t("header.language")}</div>
      <button type="button" className="app-popover-item" onClick={() => setCurrentLang("vi")}>
        <span>{t("header.vietnamese")}</span>
        {currentLang === "vi" && <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />}
      </button>
      <button type="button" className="app-popover-item" onClick={() => setCurrentLang("en")}>
        <span>{t("header.english")}</span>
        {currentLang === "en" && <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F6F8FB" }}>
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
              <span className="sidebar-logo-name">{t("sidebar.appName")}</span>
              <span className="sidebar-logo-sub">{t("sidebar.appSubtitle")}</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav-main">
          {MAIN_NAV.map((item) => (
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
          {BOTTOM_NAV.map((item) => (
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
              title={sidebarExpanded ? t("header.collapseSidebar") : t("header.expandSidebar")}
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
                {t("header.searchPlaceholder")}
              </span>
              <kbd className="app-header-search-kbd">Ctrl K</kbd>
            </button>

            <Popover content={branchContent} trigger="click" placement="bottomRight" arrow={false}>
              <button type="button" className="app-header-branch">
                <span className="app-header-branch-dot" />
                <span className="app-header-branch-name">{clinicName}</span>
                <DownOutlined style={{ fontSize: 14, color: "#5A6B82" }} />
              </button>
            </Popover>

            <div className="app-header-actions">
              <Popover content={langContent} trigger="click" placement="bottomRight" arrow={false}>
                <button type="button" className="app-header-icon-btn" aria-label={t("header.language")}>
                  <GlobalOutlined style={{ fontSize: 18 }} />
                </button>
              </Popover>

              <NotificationBell />

              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div className="app-header-user" role="button" tabIndex={0} aria-label={t("header.userAccount")}>
                  <Avatar
                    size={32}
                    style={{ backgroundColor: brand.blue, fontSize: 13, fontWeight: 700 }}
                  >
                    {initialsOf(user?.name)}
                  </Avatar>
                  <span className="app-header-user-name">{user?.name ?? "Admin"}</span>
                  <DownOutlined style={{ fontSize: 14, color: "#5A6B82" }} />
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
                placeholder={t("header.searchPlaceholder")}
                onPressEnter={() => setSearchOpen(false)}
                style={{ borderRadius: 12 }}
              />
              <kbd className="app-search-esc" onClick={() => setSearchOpen(false)}>Esc</kbd>
            </div>
            <div className="app-search-categories">
              <div className="app-search-categories-title">{t("header.searchHint")}</div>
              {SEARCH_CATEGORIES.map((cat) => (
                <div key={cat.titleKey} className="app-search-category-item">
                  <span className="app-search-category-icon">{cat.icon}</span>
                  <div className="app-search-category-text">
                    <span className="app-search-category-name">{t(cat.titleKey)}</span>
                    <span className="app-search-category-desc">{t(cat.descKey)}</span>
                  </div>
                </div>
              ))}
              <div className="app-search-hint">{t("header.searchMinChars")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
