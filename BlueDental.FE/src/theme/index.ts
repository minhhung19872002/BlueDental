import type { ThemeConfig } from "antd";

/**
 * Design tokens for BlueDental.
 * Primary color: dental blue — professional, clinical, trustworthy.
 */
export const brand = {
  /** Blue primary — main buttons, links, emphasis */
  blue: "#1565C0",
  blueDark: "#0D47A1",
  blueMid: "#1976D2",
  blueLight: "#90CAF9",
  bluePale: "#E3F2FD",
  /** Dark ink for sidebar, footer */
  ink: "#0D1B2A",
  body: "#1A2744",
  sub: "#374E6E",
  muted: "#5E748E",
  faint: "#8FA8C0",
  dim: "#4A6080",
  /** Borders and backgrounds */
  line: "#D0DCE8",
  lineSoft: "#E8EFF6",
  border: "#C5D5E4",
  bg: "#F4F7FA",
  bgSoft: "#F8FAFB",
  bgHead: "#EEF3F8",
  /** Accent colors */
  gold: "#F9A825",
  red: "#C62828",
  redDark: "#8E1C1C",
  amber: "#E65100",
  green: "#2E7D32",
  teal: "#00695C",
  purple: "#6A1B9A",
  success: "#2E7D32",
} as const;

export const statusPalette = {
  scheduled: { label: "Đã đặt lịch", bg: "#E3F2FD", color: "#1565C0" },
  confirmed: { label: "Đã xác nhận", bg: "#E8F5E9", color: "#2E7D32" },
  inProgress: { label: "Đang khám", bg: "#FFF8E1", color: "#E65100" },
  completed: { label: "Hoàn thành", bg: "#E8F5E9", color: "#2E7D32" },
  cancelled: { label: "Đã hủy", bg: "#FFEBEE", color: "#C62828" },
  noShow: { label: "Không đến", bg: "#F3E5F5", color: "#6A1B9A" },
} as const;

export const FONT_FAMILY =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: brand.blue,
    colorLink: brand.blue,
    colorLinkHover: brand.blueDark,
    colorInfo: brand.blue,
    colorSuccess: brand.success,
    colorWarning: brand.amber,
    colorError: brand.red,
    colorTextBase: brand.body,
    colorBorder: brand.border,
    colorBorderSecondary: brand.line,
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    colorBgLayout: brand.bg,
  },
  components: {
    Layout: {
      siderBg: brand.ink,
      headerBg: "#ffffff",
      bodyBg: brand.bg,
    },
    Menu: {
      darkItemBg: "transparent",
      darkSubMenuItemBg: "transparent",
      darkItemColor: brand.faint,
      darkItemHoverBg: "rgba(255, 255, 255, 0.06)",
      darkItemHoverColor: "#ffffff",
      darkItemSelectedBg: "rgba(21, 101, 192, 0.30)",
      darkItemSelectedColor: "#ffffff",
      itemHeight: 38,
      itemBorderRadius: 9,
      groupTitleColor: brand.dim,
    },
    Table: {
      headerBg: brand.bgHead,
      headerColor: brand.muted,
      rowHoverBg: brand.bgSoft,
      borderColor: brand.lineSoft,
    },
    Card: {
      paddingLG: 20,
      colorBorderSecondary: brand.line,
      borderRadiusLG: 14,
    },
    Breadcrumb: {
      fontSize: 13,
      itemColor: brand.faint,
      lastItemColor: brand.ink,
      separatorColor: brand.border,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
    },
    Input: {
      activeShadow: `0 0 0 3px ${brand.bluePale}`,
    },
  },
};

export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const HEADER_HEIGHT = 58;
