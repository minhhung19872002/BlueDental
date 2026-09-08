/**
 * The application's menu, as `BlueDental v2.dc.html` draws it: entries grouped
 * four ways along the header, each group opening a ribbon of its members
 * underneath, rather than a rail down the left.
 *
 * Icon geometry is the design's own `navDef` path data, traced at 24×24 with a
 * 1.7 stroke, rather than an icon set that only approximates it.
 */

export interface NavEntry {
  /** Route this entry opens. */
  path: string;
  /** Vietnamese label — which is also its translation key, see lib/i18n. */
  label: string;
  /** 24×24 path data. */
  icon: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  /**
   * A group either carries members, or is a link in its own right and opens no
   * ribbon at all — "Tổng quan" is the second kind.
   */
  path?: string;
  items?: NavEntry[];
}

/**
 * Every destination the menu offers, in the design's own order — which is the
 * order the mobile drawer lists them in.
 *
 * The design's `navDef` has one more entry than this: `plan` ("Điều trị"),
 * which in the design opens a patient's record on its treatment tab. Treatment
 * here lives inside a patient's record too, and has no list route of its own,
 * so it is left out rather than added as a link that goes nowhere.
 *
 * `settings` ("Cài đặt") is not in the design's menu either — it moved into the
 * account dropdown, where the profile and password entries already were.
 */
export const NAV_ENTRIES = {
  dashboard: {
    path: "/dashboard",
    label: "Tổng quan",
    icon: "M4 13h6V4H4v9zm10 7h6v-9h-6v9zM4 20h6v-4H4v4zm10-11h6V4h-6v5z",
  },
  reception: {
    path: "/reception",
    label: "Tiếp nhận",
    icon: "M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  },
  calendar: {
    path: "/calendar",
    label: "Lịch hẹn",
    icon: "M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  },
  patients: {
    path: "/patient",
    label: "Bệnh nhân",
    icon: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zm11 17v-2a4 4 0 00-3-3.87",
  },
  billing: {
    path: "/billing",
    label: "Thanh toán",
    icon: "M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm4 8h4",
  },
  materials: {
    path: "/materials",
    label: "Vật tư",
    icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8",
  },
  staff: {
    path: "/staff",
    label: "Nhân sự",
    icon: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 3a4 4 0 100 8 4 4 0 000-8zM21 8v6m3-3h-6",
  },
  labo: {
    path: "/labo",
    label: "Labo",
    icon: "M9 3h6v5l4 9a3 3 0 01-3 4H8a3 3 0 01-3-4l4-9V3z",
  },
  cskh: {
    path: "/cskh-grouping",
    label: "CSKH",
    icon: "M12 21s-6-4.5-6-9a4 4 0 018-1 4 4 0 018 1c0 4.5-6 9-6 9z",
  },
  voucher: {
    path: "/voucher",
    label: "Voucher",
    icon: "M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8zm12-2v12",
  },
  taxonomy: {
    path: "/taxonomy",
    label: "Danh mục",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  operations: {
    path: "/operations",
    label: "Vận hành",
    icon: "M3 21V9l9-6 9 6v12M9 21v-7h6v7",
  },
  tools: {
    path: "/tools",
    label: "Công cụ",
    icon: "M14 6l4 4-8 8H6v-4l8-8zM17 3l4 4",
  },
  reports: {
    path: "/report",
    label: "Báo cáo",
    icon: "M4 19V5m0 14h16M8 19v-6m4 6V8m4 11v-9",
  },
} as const satisfies Record<string, NavEntry>;

/** Flat list, in the design's order — what the mobile drawer shows. */
export const NAV_FLAT: readonly NavEntry[] = Object.values(NAV_ENTRIES);

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "dashboard",
    label: "Tổng quan",
    icon: NAV_ENTRIES.dashboard.icon,
    path: NAV_ENTRIES.dashboard.path,
  },
  {
    id: "clinic",
    label: "Phòng khám",
    icon: "M12 21s-6-4.5-6-9a4 4 0 018-1 4 4 0 018 1c0 4.5-6 9-6 9z",
    items: [NAV_ENTRIES.reception, NAV_ENTRIES.calendar, NAV_ENTRIES.patients, NAV_ENTRIES.cskh],
  },
  {
    id: "finance",
    label: "Tài chính",
    icon: "M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm4 8h4",
    items: [NAV_ENTRIES.billing, NAV_ENTRIES.voucher, NAV_ENTRIES.reports],
  },
  {
    id: "ops",
    label: "Vận hành",
    icon: "M3 21V9l9-6 9 6v12M9 21v-7h6v7",
    items: [
      NAV_ENTRIES.materials,
      NAV_ENTRIES.labo,
      NAV_ENTRIES.staff,
      NAV_ENTRIES.operations,
      NAV_ENTRIES.tools,
      NAV_ENTRIES.taxonomy,
    ],
  },
];

/**
 * Whether a route is the one on screen.
 *
 * Prefix matching, so a patient's record still lights "Bệnh nhân" — except for
 * reception, whose path is a prefix of nothing but would otherwise stay lit
 * while a sub-route of its own is open.
 */
export function isNavPathActive(path: string, pathname: string): boolean {
  if (path === NAV_ENTRIES.reception.path) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Whether a group holds the route on screen, so its button reads as chosen. */
export function isNavGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.path) return isNavPathActive(group.path, pathname);
  return (group.items ?? []).some((item) => isNavPathActive(item.path, pathname));
}
