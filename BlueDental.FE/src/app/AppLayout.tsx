import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Dropdown, Popover, type MenuProps } from "antd";
import {
  DownOutlined,
  GlobalOutlined,
  KeyOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { GlobalSearch } from "@/components/GlobalSearch";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useClinicBranches } from "@/features/organizations/api";
import { useBranchStore } from "@/lib/clinicBranch";
import { useLanguage, useT } from "@/lib/i18n";
import { brand } from "@/theme/index";

import { HeaderNavGroups, MobileNavDrawer, NavRibbon } from "./HeaderNav";
import { NAV_GROUPS, type NavEntry, type NavGroup } from "./nav";

function initialsOf(name: string | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [, setLanguage] = useLanguage();

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

  /* Nothing that hangs off the bar survives a change of page. */
  const closeMenus = useCallback(() => {
    setOpenGroupId(null);
    setNotifOpen(false);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    closeMenus();

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
  }, [location.pathname, closeMenus]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        closeMenus();
      }
    },
    [closeMenus],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  /*
   * A group either goes somewhere itself, or opens. It never toggles shut:
   * moving along the bar would otherwise cost a click to re-open whichever
   * group you happened to land on first.
   */
  const handleOpenGroup = (group: NavGroup) => {
    setNotifOpen(false);
    if (group.path) {
      setOpenGroupId(null);
      navigate(group.path);
      return;
    }
    setOpenGroupId(group.id);
  };

  const handleSelectEntry = (entry: NavEntry) => {
    closeMenus();
    setDrawerOpen(false);
    navigate(entry.path);
  };

  const openGroup = NAV_GROUPS.find((g) => g.id === openGroupId);
  const ribbonItems = openGroup?.items ?? [];

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
    {
      /* The design's menu has no entry for this, so the account block carries
         it — the only place left that is on every screen. */
      key: "settings",
      icon: <SettingOutlined />,
      label: t("Cài đặt"),
      onClick: () => navigate("/settings"),
    },
    {
      /* The header carries no language control, so the account block is the
         only place to change language. */
      key: "language",
      icon: <GlobalOutlined />,
      label: t("Ngôn ngữ"),
      children: [
        {
          key: "lang-vi",
          label: t("Tiếng Việt"),
          onClick: () => setLanguage("vi"),
        },
        {
          key: "lang-en",
          label: "English",
          onClick: () => setLanguage("en"),
        },
      ],
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

  const clinicName = user?.clinicName ?? t("NHA KHOA ĐỨC HẠNH PREMIUM");
  const clinicLogoUrl = user?.clinicLogoUrl ?? "/logo.png";

  const queryClient = useQueryClient();
  const { data: branches } = useClinicBranches(true);
  const currentBranchId = useBranchStore((s) => s.currentBranchId);
  const setCurrentBranchId = useBranchStore((s) => s.setCurrentBranchId);

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
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
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

  const menusOpen = openGroupId !== null || notifOpen;

  return (
    /* One column, full width: the design's v2 has no rail at all. */
    <div className="app-shell">
      <div className="app-topbar">
        <header className="app-header">
          <div className="app-header-brand">
            <img src={clinicLogoUrl} alt={clinicName} className="app-header-logo" />
            <p className="app-header-clinic-name app-header-hide-sm">{clinicName}</p>
          </div>

          <button
            type="button"
            className="app-header-burger"
            title={t("Mở menu")}
            aria-label={t("Mở menu")}
            onClick={() => setDrawerOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <HeaderNavGroups
            pathname={location.pathname}
            openGroupId={openGroupId}
            onOpenGroup={handleOpenGroup}
          />

          <button type="button" className="app-header-search" onClick={() => setSearchOpen(true)}>
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
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
            <button type="button" className="app-header-branch app-header-hide-sm">
              <span className="app-header-branch-dot" />
              <span className="app-header-branch-name">{selectedBranchName}</span>
              <DownOutlined style={{ fontSize: 13, color: "#78819c" }} />
            </button>
          </Popover>

          <NotificationBell
            open={notifOpen}
            onOpen={() => {
              setOpenGroupId(null);
              setNotifOpen(true);
            }}
            onClose={() => setNotifOpen(false)}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              className="app-header-user"
              role="button"
              tabIndex={0}
              aria-label={t("Tài khoản người dùng")}
            >
              <Avatar size={34} className="app-header-avatar">
                {initialsOf(user?.name)}
              </Avatar>
              <span className="app-header-user-name app-header-hide-sm">
                {user?.name ?? t("Quản trị viên")}
              </span>
            </div>
          </Dropdown>
        </header>

        {ribbonItems.length > 0 && (
          <NavRibbon
            items={ribbonItems}
            pathname={location.pathname}
            onSelect={handleSelectEntry}
          />
        )}
      </div>

      <div className="app-main">
        {/* Catches the click that dismisses an open menu. It sits inside the
            scrolling area, which starts below the bar, so the bar itself stays
            live: over it, the second click of a group-to-group switch would
            land here instead of on the button. */}
        {menusOpen && <div className="app-nav-backdrop" onClick={closeMenus} />}

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <MobileNavDrawer
        open={drawerOpen}
        pathname={location.pathname}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleSelectEntry}
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
