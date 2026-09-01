import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Avatar,
  Drawer,
  Dropdown,
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
  CheckOutlined,
  MenuOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useLanguage, useT } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { brand, SIDEBAR_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "@/theme/index";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useClinicBranches } from "@/features/organizations/api";
import { useBranchStore } from "@/lib/clinicBranch";

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

/** The rail's own wordmark — the header carries the clinic's full name. */
const CLINIC_SHORT_NAME = "Đức Hạnh Premium";

/** Translator type, so the builders below stay readable. */
type Translate = (vietnamese: string) => string;

/**
 * The rail's icons are the design's own `navDef` paths, traced at 24x24 with a
 * 1.7 stroke, rather than an icon set that only approximates them.
 */
function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Order, labels and icons follow BlueDental.dc.html's `navDef`.
 *
 * `plan` ("Điều trị") is in that list but has no artboard of its own and no
 * route here — treatment lives inside a patient's record — so it is left out
 * rather than added as a link that goes nowhere.
 */
const NAV_ICON_PATHS = {
  dashboard: "M4 13h6V4H4v9zm10 7h6v-9h-6v9zM4 20h6v-4H4v4zm10-11h6V4h-6v5z",
  reception: "M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  calendar: "M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  patients: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zm11 17v-2a4 4 0 00-3-3.87",
  billing: "M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm4 8h4",
  materials: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8",
  staff: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 3a4 4 0 100 8 4 4 0 000-8zM21 8v6m3-3h-6",
  labo: "M9 3h6v5l4 9a3 3 0 01-3 4H8a3 3 0 01-3-4l4-9V3z",
  cskh: "M12 21s-6-4.5-6-9a4 4 0 018-1 4 4 0 018 1c0 4.5-6 9-6 9z",
  voucher: "M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8zm12-2v12",
  taxonomy: "M4 6h16M4 12h16M4 18h10",
  operations: "M3 21V9l9-6 9 6v12M9 21v-7h6v7",
  tools: "M14 6l4 4-8 8H6v-4l8-8zM17 3l4 4",
  reports: "M4 19V5m0 14h16M8 19v-6m4 6V8m4 11v-9",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2-1.2L14.5 2h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
} as const;

// The navigation is built per render: its labels follow the chosen language.
const mainNav = (t: Translate): NavItem[] => [
  { key: "/dashboard", icon: <NavIcon d={NAV_ICON_PATHS.dashboard} />, label: t("Tổng quan") },
  { key: "/reception", icon: <NavIcon d={NAV_ICON_PATHS.reception} />, label: t("Tiếp nhận") },
  { key: "/calendar", icon: <NavIcon d={NAV_ICON_PATHS.calendar} />, label: t("Lịch hẹn") },
  { key: "/patient", icon: <NavIcon d={NAV_ICON_PATHS.patients} />, label: t("Bệnh nhân") },
  { key: "/billing", icon: <NavIcon d={NAV_ICON_PATHS.billing} />, label: t("Thanh toán") },
  { key: "/materials", icon: <NavIcon d={NAV_ICON_PATHS.materials} />, label: t("Vật tư") },
  { key: "/staff", icon: <NavIcon d={NAV_ICON_PATHS.staff} />, label: t("Nhân sự") },
  { key: "/labo", icon: <NavIcon d={NAV_ICON_PATHS.labo} />, label: t("Labo") },
  { key: "/cskh-grouping", icon: <NavIcon d={NAV_ICON_PATHS.cskh} />, label: t("CSKH") },
  { key: "/voucher", icon: <NavIcon d={NAV_ICON_PATHS.voucher} />, label: t("Voucher") },
  { key: "/taxonomy", icon: <NavIcon d={NAV_ICON_PATHS.taxonomy} />, label: t("Danh mục") },
  { key: "/operations", icon: <NavIcon d={NAV_ICON_PATHS.operations} />, label: t("Vận hành") },
  { key: "/tools", icon: <NavIcon d={NAV_ICON_PATHS.tools} />, label: t("Công cụ") },
  { key: "/report", icon: <NavIcon d={NAV_ICON_PATHS.reports} />, label: t("Báo cáo") },
  { key: "/settings", icon: <NavIcon d={NAV_ICON_PATHS.settings} />, label: t("Cài đặt") },
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
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    setMobileMenuOpen(false);

    const storeBranchId = useBranchStore.getState().currentBranchId;
    const url = new URL(window.location.href);
    const urlBranchId = url.searchParams.get("branchId");

    if (urlBranchId && urlBranchId !== storeBranchId) {
      useBranchStore.getState().setCurrentBranchId(urlBranchId);
      return;
    }

    if (storeBranchId) {
      if (urlBranchId !== storeBranchId) {
        url.searchParams.set("branchId", storeBranchId);
        window.history.replaceState(null, "", url.toString());
      }
    } else if (url.searchParams.has("branchId")) {
      url.searchParams.delete("branchId");
      window.history.replaceState(null, "", url.toString());
    }
  }, [location.pathname]);

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
    navigate(item.key);
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
      onClick: () => navigate("/settings?tab=info"),
    },
    {
      key: "change-password",
      icon: <KeyOutlined />,
      label: t("Đổi mật khẩu"),
      onClick: () => navigate("/settings?tab=password"),
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
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo.png";
  const clinicTagline = user?.clinicTagline ?? "Kiến Tạo Nụ Cười - Giá Trị Bền Vững";
  /* The rail is 236px wide, so it takes the short form of the name; the
     header beside it carries the full one from the clinic record. */
  const clinicShortName = CLINIC_SHORT_NAME;
  const sidebarWidth = sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_WIDTH;

  const queryClient = useQueryClient();
  const { data: branches } = useClinicBranches(true);
  const currentBranchId = useBranchStore((s) => s.currentBranchId);
  const setCurrentBranchId = useBranchStore((s) => s.setCurrentBranchId);

  const [branchMenuOpen, setBranchMenuOpen] = useState(false);

  const handleBranchChange = (id: string | null) => {
    setBranchMenuOpen(false);
    setCurrentBranchId(id);
    void queryClient.invalidateQueries();
  };

  // A branch id belongs to one account's world: a link or a stored id from
  // another account points at a branch this one may not open, so drop it.
  useEffect(() => {
    if (!branches || !currentBranchId) return;
    const valid = branches.some((b) => b.id === currentBranchId);
    if (!valid) handleBranchChange(null);
  }, [branches, currentBranchId]);

  const selectedBranchName =
    currentBranchId === null
      ? t("Tất cả chi nhánh")
      : (branches?.find((b) => b.id === currentBranchId)?.name ?? clinicName);

  const branchContent = (
    <div className="app-popover-list">
      <div className="app-popover-header">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        {t("Chi nhánh")}
      </div>
      <div className="app-popover-divider" />
      <button
        type="button"
        className={`app-popover-item${currentBranchId === null ? " app-popover-item--active" : ""}`}
        onClick={() => handleBranchChange(null)}
      >
        <span
          className="app-popover-dot"
          style={{ background: currentBranchId === null ? "#0e9f6e" : brand.faint }}
        />
        <span>{t("Tất cả chi nhánh")}</span>
      </button>
      {(branches ?? []).length > 0 && <div className="app-popover-divider" />}
      {(branches ?? []).map((branch) => {
        const isActive = branch.id === currentBranchId;
        return (
          <button
            key={branch.id}
            type="button"
            className={`app-popover-item app-popover-item--branch${isActive ? " app-popover-item--active" : ""}`}
            onClick={() => handleBranchChange(branch.id)}
          >
            <span
              className="app-popover-dot"
              style={{ background: isActive ? "#0e9f6e" : brand.faint }}
            />
            <span>{branch.name}</span>
          </button>
        );
      })}
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
    /* The rail and the content column are siblings in a row: the rail floats
       clear of the viewport edge, so nothing can be offset against it. */
    <div className="app-shell" style={{ "--bd-rail-width": `${sidebarWidth}px` } as React.CSSProperties}>
      {/* ── Sidebar ── */}
      <aside className="app-sidebar">
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
              <span className="sidebar-logo-name">{clinicShortName}</span>
              <span className="sidebar-logo-sub">{t("Quản trị vận hành")}</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav-main">
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

        {/* Bottom nav — sign out, as the design has it. */}
        <nav className="sidebar-nav-bottom">
          <SidebarNavItem
            item={{ key: "logout", icon: <LogoutOutlined />, label: t("Đăng xuất") }}
            active={false}
            expanded={sidebarExpanded}
            onClick={() => logoutMutation.mutate()}
          />
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="app-main">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="app-header-left">
            <button
              type="button"
              className="app-header-toggle sidebar-mobile-only"
              onClick={() => setMobileMenuOpen(true)}
              title={t("Mở menu")}
            >
              <MenuOutlined style={{ fontSize: 18 }} />
            </button>

            <button
              type="button"
              className="app-header-toggle sidebar-desktop-only"
              onClick={() => setSidebarExpanded((prev) => !prev)}
              title={sidebarExpanded ? t("Thu gọn menu") : t("Mở rộng menu")}
            >
              {/* The design draws three plain rules here, the same whichever
                  way the rail is sitting; the title says which way it goes. */}
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 5h18M3 12h18M3 19h18" />
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

            <Popover
              content={branchContent}
              trigger="click"
              placement="bottomRight"
              arrow={false}
              open={branchMenuOpen}
              onOpenChange={setBranchMenuOpen}
            >
              <button type="button" className="app-header-branch">
                <span className="app-header-branch-dot" />
                <span className="app-header-branch-name">{selectedBranchName}</span>
                <DownOutlined style={{ fontSize: 14, color: "#78819c" }} />
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
                  <Avatar size={32} className="app-header-avatar">
                    {initialsOf(user?.name)}
                  </Avatar>
                  <span className="app-header-user-name">{user?.name ?? "Admin"}</span>
                  <DownOutlined style={{ fontSize: 14, color: "#78819c" }} />
                </div>
              </Dropdown>
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile sidebar drawer ── */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        width={260}
        closable={false}
        styles={{
          body: { padding: 0, background: "var(--bd-sidebar-bg)", display: "flex", flexDirection: "column", height: "100%" },
          wrapper: {},
        }}
        className="sidebar-drawer"
      >
        <div className="sidebar-mobile-header">
          <div className="sidebar-logo-area">
            <div className="sidebar-logo-img-wrap">
              <img src={clinicLogoUrl} alt={clinicName} className="sidebar-logo-img" />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">BlueDental</span>
              <span className="sidebar-logo-sub">{t("Quản trị vận hành")}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t("Đóng menu")}
          >
            <CloseOutlined style={{ fontSize: 16 }} />
          </button>
        </div>

        <nav className="sidebar-nav-main">
          {mainNav(t).map((item) => (
            <SidebarNavItem
              key={item.key}
              item={item}
              active={isActive(item.key)}
              expanded
              onClick={() => handleNavClick(item)}
            />
          ))}
        </nav>

        <nav className="sidebar-nav-bottom">
          <SidebarNavItem
            item={{ key: "logout", icon: <LogoutOutlined />, label: t("Đăng xuất") }}
            active={false}
            expanded
            onClick={() => logoutMutation.mutate()}
          />
        </nav>
      </Drawer>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
