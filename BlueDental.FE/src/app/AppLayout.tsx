import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  User,
  LogOut,
  Bell,
  Search,
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
  Check,
  KeyRound,
  ChevronDown,
  Globe,
  Headphones,
  FlaskConical,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage, useT } from "@/lib/i18n";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { brand, SIDEBAR_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "@/theme/index";
import { GlobalSearch } from "@/components/GlobalSearch";

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
    navigate(item.key);
  };

  const isActive = (key: string) => {
    if (key === "/reception") return location.pathname === "/reception";
    return location.pathname.startsWith(key);
  };

  const clinicName = user?.clinicName ?? "NHA KHOA ĐỨC HẠNH PREMIUM";
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo.png";
  const clinicTagline = user?.clinicTagline ?? "Kiến Tạo Nụ Cười - Giá Trị Bền Vững";
  const sidebarWidth = sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa" }}>
      {/* ── Sidebar ── */}
      <aside className="app-sidebar" style={{ width: sidebarWidth }}>
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
              <Search size={16} />
              <span className="app-header-search-text">
                {t("Tìm kiếm khách hàng, lịch hẹn, nhân viên…")}
              </span>
              <kbd className="app-header-search-kbd">Ctrl K</kbd>
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="app-header-branch">
                  <span className="app-header-branch-dot" />
                  <span className="app-header-branch-name">{clinicName}</span>
                  <ChevronDown size={14} color="#6f7c90" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
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
              </PopoverContent>
            </Popover>

            <div className="app-header-actions">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="app-header-icon-btn" aria-label={t("Ngôn ngữ")}>
                    <Globe size={18} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-0">
                  <div className="app-popover-list">
                    <div className="app-popover-header">{t("Ngôn ngữ")}</div>
                    <button type="button" className="app-popover-item" onClick={() => setLanguage("vi")}>
                      <span>{t("Tiếng Việt")}</span>
                      {language === "vi" && <Check size={12} color={brand.blue} />}
                    </button>
                    <button type="button" className="app-popover-item" onClick={() => setLanguage("en")}>
                      <span>English</span>
                      {language === "en" && <Check size={12} color={brand.blue} />}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <button type="button" className="app-header-icon-btn" aria-label={t("Thông báo")}>
                <Bell size={18} />
                <span className="app-header-notif-dot" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="app-header-user" role="button" tabIndex={0} aria-label={t("Tài khoản người dùng")}>
                    <Avatar className="size-8">
                      <AvatarImage src={undefined} />
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ backgroundColor: brand.blue }}
                      >
                        {initialsOf(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="app-header-user-name">{user?.name ?? "Admin"}</span>
                    <ChevronDown size={14} color="#6f7c90" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    {user?.clinicName ?? "BlueDental"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account/profile")}>
                    <User className="size-4" />
                    {t("Thông tin cá nhân")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/change-password")}>
                    <KeyRound className="size-4" />
                    {t("Đổi mật khẩu")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="size-4" />
                    {t("Đăng xuất")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main style={{ padding: 16, minHeight: 280 }}>
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
