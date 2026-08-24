import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  CalendarCheck,
  Users,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  IdCard,
  Pill,
  LayoutGrid,
  Wrench,
  Headphones,
  FlaskConical,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { SIDEBAR_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "@/theme/index";
import { AppHeader } from "./AppHeader";

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

type Translate = (vietnamese: string) => string;

const mainNav = (t: Translate): NavItem[] => [
  { key: "/reception", icon: <CalendarCheck className="size-4" />, label: t("Tiếp nhận") },
  { key: "/patient", icon: <Users className="size-4" />, label: t("Danh sách bệnh nhân") },
  { key: "/calendar", icon: <Calendar className="size-4" />, label: t("Lịch hẹn") },
  { key: "/cskh-grouping", icon: <Headphones className="size-4" />, label: t("CSKH - Phân nhóm") },
  { key: "/labo", icon: <FlaskConical className="size-4" />, label: t("Labo") },
  { key: "/billing", icon: <DollarSign className="size-4" />, label: t("Thanh toán") },
  { key: "/operations", icon: <Settings className="size-4" />, label: t("Quản trị vận hành") },
  { key: "/report", icon: <BarChart3 className="size-4" />, label: t("Báo cáo") },
  { key: "/staff", icon: <IdCard className="size-4" />, label: t("Nhân viên") },
  { key: "/materials", icon: <Pill className="size-4" />, label: t("Vật tư") },
  { key: "/taxonomy", icon: <LayoutGrid className="size-4" />, label: t("Danh mục") },
  { key: "/tools", icon: <Wrench className="size-4" />, label: t("Công cụ") },
];

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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleNavClick = (item: NavItem) => {
    navigate(item.key);
  };

  const isActive = (key: string) => {
    if (key === "/reception") return location.pathname === "/reception";
    return location.pathname.startsWith(key);
  };

  const clinicName = user?.clinicName ?? "NHA KHOA ĐỨC HẠNH PREMIUM";
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo.png";
  const sidebarWidth = sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa" }}>
      {/* ── Sidebar (desktop) ── */}
      <aside className="app-sidebar sidebar-desktop" style={{ width: sidebarWidth }}>
        <div className={`sidebar-logo-area ${!sidebarExpanded ? "sidebar-logo-area--collapsed" : ""}`}>
          <div className="sidebar-logo-img-wrap">
            <img src={clinicLogoUrl} alt={clinicName} className="sidebar-logo-img" />
          </div>
          {sidebarExpanded && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">BlueDental</span>
              <span className="sidebar-logo-sub">{t("Quản trị vận hành")}</span>
            </div>
          )}
        </div>

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

        <nav className="sidebar-nav-bottom">
          <SidebarNavItem
            item={{ key: "logout", icon: <LogOut className="size-4" />, label: t("Đăng xuất") }}
            active={false}
            expanded={sidebarExpanded}
            onClick={() => logoutMutation.mutate()}
          />
        </nav>
      </aside>

      {/* ── Sidebar (mobile drawer) ── */}
      {mobileMenuOpen && (
        <div className="sidebar-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`app-sidebar sidebar-mobile ${mobileMenuOpen ? "sidebar-mobile--open" : ""}`}>
        <div className="sidebar-mobile-header">
          <div className="sidebar-logo-area">
            <div className="sidebar-logo-img-wrap">
              <img src={clinicLogoUrl} alt={clinicName} className="sidebar-logo-img" />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">BlueDental</span>
              <span className="sidebar-logo-sub">{t("Phần Mềm Quản Trị Vận Hành")}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t("Đóng menu")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-mobile-section-label">{t("MENU")}</div>
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

        <div className="sidebar-mobile-section-label">{t("KHÁC")}</div>
        <nav className="sidebar-nav-bottom">
          <SidebarNavItem
            item={{ key: "logout", icon: <LogOut className="size-4" />, label: t("Đăng xuất") }}
            active={false}
            expanded
            onClick={() => logoutMutation.mutate()}
          />
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div
        className="app-main"
        style={{ marginLeft: sidebarWidth, transition: "margin-left 0.2s" }}
      >
        <AppHeader
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main style={{ padding: 16, minHeight: 280 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
