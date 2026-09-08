import { Drawer } from "antd";

import { useT } from "@/lib/i18n";

import {
  isNavGroupActive,
  isNavPathActive,
  NAV_FLAT,
  NAV_GROUPS,
  type NavEntry,
  type NavGroup,
} from "./nav";

/**
 * The menu's icons are the design's own path data, so they carry its line
 * weight and terminals rather than an icon set's approximation of them.
 */
export function NavIcon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
    >
      <path d={d} />
    </svg>
  );
}

function classes(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

interface GroupsProps {
  pathname: string;
  openGroupId: string | null;
  onOpenGroup: (group: NavGroup) => void;
}

/**
 * The four group buttons in the header.
 *
 * A group that carries members only ever opens: clicking the one already open
 * leaves it open, so moving along the bar never costs a click to re-open what
 * you just closed by accident.
 */
export function HeaderNavGroups({ pathname, openGroupId, onOpenGroup }: GroupsProps) {
  const t = useT();

  return (
    <nav className="app-nav" aria-label={t("Menu chính")}>
      {NAV_GROUPS.map((group) => {
        const active = isNavGroupActive(group, pathname);
        const open = openGroupId === group.id;
        return (
          <button
            key={group.id}
            type="button"
            title={t(group.label)}
            aria-expanded={group.items ? open : undefined}
            className={classes(
              "app-nav-group",
              active && "app-nav-group--active",
              open && "app-nav-group--open",
            )}
            onClick={() => onOpenGroup(group)}
          >
            <NavIcon d={group.icon} />
            <span className="app-nav-group-label">{t(group.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

interface RibbonProps {
  items: readonly NavEntry[];
  pathname: string;
  onSelect: (entry: NavEntry) => void;
}

/** The open group's members, drawn full width directly under the header. */
export function NavRibbon({ items, pathname, onSelect }: RibbonProps) {
  const t = useT();

  return (
    <div className="app-ribbon">
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          title={t(item.label)}
          className={classes(
            "app-ribbon-item",
            isNavPathActive(item.path, pathname) && "app-ribbon-item--active",
          )}
          onClick={() => onSelect(item)}
        >
          <NavIcon d={item.icon} />
          <span>{t(item.label)}</span>
        </button>
      ))}
    </div>
  );
}

interface DrawerProps {
  open: boolean;
  pathname: string;
  onClose: () => void;
  onSelect: (entry: NavEntry) => void;
}

/** Below 1100px the group bar cannot fit, and this holds the whole menu. */
export function MobileNavDrawer({ open, pathname, onClose, onSelect }: DrawerProps) {
  const t = useT();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      size={264}
      closable={false}
      className="app-drawer"
      styles={{ body: { padding: 14, background: "#fff" } }}
    >
      <div className="app-drawer-heading">{t("MENU")}</div>
      {NAV_FLAT.map((item) => (
        <button
          key={item.path}
          type="button"
          title={t(item.label)}
          className={classes(
            "app-drawer-item",
            isNavPathActive(item.path, pathname) && "app-drawer-item--active",
          )}
          onClick={() => onSelect(item)}
        >
          <NavIcon d={item.icon} size={18} />
          <span>{t(item.label)}</span>
        </button>
      ))}
    </Drawer>
  );
}
