import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
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
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import {
  brand,
  SIDEBAR_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "@/theme/index";

const { Content } = Layout;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { key: "/reception", icon: <ScheduleOutlined />, label: "Tiếp nhận" },
  { key: "/patient", icon: <TeamOutlined />, label: "Danh sách bệnh nhân" },
  { key: "/calendar", icon: <CalendarOutlined />, label: "Lịch hẹn" },
  { key: "/cskh-grouping", icon: <CustomerServiceOutlined />, label: "CSKH - Phân nhóm" },
  { key: "/labo", icon: <ExperimentOutlined />, label: "Labo" },
  { key: "/operations", icon: <SettingOutlined />, label: "Quản trị vận hành" },
  { key: "/report", icon: <BarChartOutlined />, label: "Báo cáo" },
  { key: "/staff", icon: <IdcardOutlined />, label: "Nhân viên" },
  { key: "/materials", icon: <MedicineBoxOutlined />, label: "Vật tư" },
  { key: "/taxonomy", icon: <AppstoreOutlined />, label: "Danh mục" },
  { key: "/tools", icon: <ToolOutlined />, label: "Công cụ" },
];

const BOTTOM_NAV: NavItem[] = [
  {
    key: "https://nfcdental.com/",
    icon: <QuestionCircleOutlined />,
    label: "Hướng dẫn & hỗ trợ",
    external: true,
  },
];

const SEARCH_CATEGORIES = [
  {
    icon: <UserOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: "Khách hàng",
    desc: "Tìm theo tên, mã KH, số điện thoại",
  },
  {
    icon: <CalendarOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: "Lịch hẹn",
    desc: "Tìm theo tên hoặc SĐT khách hàng",
  },
  {
    icon: <HeartOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: "CSKH",
    desc: "Tìm theo khách hàng, nội dung",
  },
  {
    icon: <IdcardOutlined style={{ fontSize: 18, color: brand.muted }} />,
    title: "Nhân viên",
    desc: "Tìm theo tên, email, số điện thoại",
  },
];

function initialsOf(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function SidebarItem({
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sidebar-nav-item ${active ? "sidebar-nav-item--active" : ""} ${expanded ? "sidebar-nav-item--expanded" : ""}`}
    >
      <span className="sidebar-nav-icon">{item.icon}</span>
      <span className="sidebar-nav-label">{item.label}</span>
    </button>
  );
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [currentLang, setCurrentLang] = useState<"vi" | "en">("vi");
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

  const currentSidebarWidth = sidebarExpanded
    ? SIDEBAR_EXPANDED_WIDTH
    : SIDEBAR_WIDTH;

  const clinicName = user?.clinicName ?? "NHA KHOA ĐỨC HẠNH PREMIUM";
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo_app.jpg";
  const clinicTagline = user?.clinicTagline ?? "Kiến Tạo Nụ Cười - Giá Trị Bền Vững";

  const branchContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">Chi nhánh</div>
      <button type="button" className="app-popover-item">
        <span
          className="app-popover-dot"
          style={{ background: brand.faint }}
        />
        <span>Tất cả chi nhánh</span>
      </button>
      <button type="button" className="app-popover-item app-popover-item--active">
        <span
          className="app-popover-dot"
          style={{ background: "#2BB673" }}
        />
        <span>{clinicName}</span>
      </button>
    </div>
  );

  const langContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">Ngôn ngữ</div>
      <button
        type="button"
        className="app-popover-item"
        onClick={() => setCurrentLang("vi")}
      >
        <span>Tiếng Việt</span>
        {currentLang === "vi" && (
          <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />
        )}
      </button>
      <button
        type="button"
        className="app-popover-item"
        onClick={() => setCurrentLang("en")}
      >
        <span>Tiếng Anh</span>
        {currentLang === "en" && (
          <CheckOutlined style={{ color: brand.blue, fontSize: 12 }} />
        )}
      </button>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* ── Sidebar ── */}
      <aside
        className={`app-sidebar ${sidebarExpanded ? "app-sidebar--expanded" : ""}`}
        style={{ width: currentSidebarWidth }}
      >
        <div className="sidebar-logo-area">
          <div className="sidebar-logo-icon">
            <img src="/logo_app.jpg" alt="NFC Dental" />
          </div>
          {sidebarExpanded && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">NFC Dental</span>
              <span className="sidebar-logo-sub">
                Phần Mềm Quản Trị Vận Hành
              </span>
            </div>
          )}
        </div>

        {sidebarExpanded && (
          <div className="sidebar-section-label">MENU</div>
        )}

        <nav className="sidebar-nav-main">
          {MAIN_NAV.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              active={isActive(item.key)}
              expanded={sidebarExpanded}
              onClick={() => handleNavClick(item)}
            />
          ))}
        </nav>

        {sidebarExpanded && (
          <div className="sidebar-section-label">KHÁC</div>
        )}

        <nav className="sidebar-nav-bottom">
          {BOTTOM_NAV.map((item) => (
            <SidebarItem
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
      <Layout
        style={{
          marginLeft: currentSidebarWidth,
          transition: "margin-left 0.2s",
        }}
      >
        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-header-left">
            <button
              type="button"
              className="app-header-toggle"
              onClick={() => setSidebarExpanded((prev) => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="1" y="1" width="16" height="16" rx="2" />
                <path d="M6 1v16" />
                <path d="M10 7l2 2-2 2" />
              </svg>
            </button>

            <div className="app-header-clinic">
              {clinicLogoUrl ? (
                <div className="app-header-clinic-logo">
                  <img
                    src={clinicLogoUrl}
                    alt={clinicName}
                    className="app-header-clinic-logo-img"
                  />
                </div>
              ) : (
                <div className="app-header-clinic-logo">
                  {initialsOf(clinicName)}
                </div>
              )}
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
                Tìm kiếm khách hàng, lịch hẹn, nhân viên…
              </span>
              <kbd className="app-header-search-kbd">Ctrl K</kbd>
            </button>

            <Popover
              content={branchContent}
              trigger="click"
              placement="bottomRight"
              arrow={false}
            >
              <button type="button" className="app-header-branch">
                <span className="app-header-branch-dot" />
                <span className="app-header-branch-name">{clinicName}</span>
                <DownOutlined style={{ fontSize: 14, color: "#5A6B82" }} />
              </button>
            </Popover>

            <div className="app-header-actions">
              <Popover
                content={langContent}
                trigger="click"
                placement="bottomRight"
                arrow={false}
              >
                <button type="button" className="app-header-icon-btn">
                  <GlobalOutlined style={{ fontSize: 18 }} />
                </button>
              </Popover>

              <button type="button" className="app-header-icon-btn">
                <BellOutlined style={{ fontSize: 18 }} />
                <span className="app-header-notif-dot" />
              </button>

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
                  <span className="app-header-user-name">
                    {user?.name ?? "Admin"}
                  </span>
                  <DownOutlined style={{ fontSize: 14, color: "#5A6B82" }} />
                </div>
              </Dropdown>
            </div>
          </div>
        </header>

        <Content style={{ padding: 16, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>

      {/* ── Global search modal ── */}
      {searchOpen && (
        <div
          className="app-search-overlay"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="app-search-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-search-input-row">
              <Input
                autoFocus
                size="large"
                prefix={<SearchOutlined />}
                placeholder="Tìm kiếm khách hàng, lịch hẹn, nhân viên…"
                onPressEnter={() => setSearchOpen(false)}
                style={{ borderRadius: 12 }}
              />
              <kbd
                className="app-search-esc"
                onClick={() => setSearchOpen(false)}
              >
                Esc
              </kbd>
            </div>

            <div className="app-search-categories">
              <div className="app-search-categories-title">
                Gợi ý tìm kiếm
              </div>
              {SEARCH_CATEGORIES.map((cat) => (
                <div key={cat.title} className="app-search-category-item">
                  <span className="app-search-category-icon">{cat.icon}</span>
                  <div className="app-search-category-text">
                    <span className="app-search-category-name">
                      {cat.title}
                    </span>
                    <span className="app-search-category-desc">
                      {cat.desc}
                    </span>
                  </div>
                </div>
              ))}
              <div className="app-search-hint">
                Nhập ít nhất 2 ký tự để tìm kiếm.
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
