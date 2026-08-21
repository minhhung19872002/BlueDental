import type { ThemeConfig } from "antd";

export const brand = {
  blue: "#1565C0",
  blueDark: "#0D47A1",
  blueMid: "#1976D2",
  blueLight: "#90CAF9",
  bluePale: "#E3F2FD",
  ink: "#0D1B2A",
  body: "#1A2744",
  sub: "#374E6E",
  muted: "#5E748E",
  faint: "#8FA8C0",
  dim: "#4A6080",
  line: "#D0DCE8",
  lineSoft: "#E8EFF6",
  border: "#C5D5E4",
  bg: "#F4F7FA",
  bgSoft: "#F8FAFB",
  bgHead: "#EEF3F8",
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
  "'Google Sans', 'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#2671D8",
    colorLink: "#2671D8",
    colorLinkHover: brand.blueDark,
    colorInfo: "#2671D8",
    colorSuccess: brand.success,
    colorWarning: brand.amber,
    colorError: brand.red,
    colorTextBase: "#1B2A41",
    colorBorder: "#DCE3EE",
    colorBorderSecondary: "#DCE3EE",
    borderRadius: 8,
    fontFamily: FONT_FAMILY,
    colorBgLayout: "#F6F8FB",
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: "#ffffff",
      headerBg: "#ffffff",
      bodyBg: brand.bg,
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemColor: brand.muted,
      itemHoverBg: brand.bluePale,
      itemHoverColor: brand.blue,
      itemSelectedBg: brand.bluePale,
      itemSelectedColor: brand.blue,
      itemHeight: 44,
      itemBorderRadius: 8,
      iconSize: 20,
    },
    Table: {
      headerBg: "#F6F8FB",
      headerColor: "#5A6B82",
      rowHoverBg: brand.bgSoft,
      borderColor: "#DCE3EE",
      cellFontSize: 14,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
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
      fontWeight: 500,
      primaryShadow: "none",
      defaultShadow: "none",
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 44,
    },
    Input: {
      activeShadow: `0 0 0 3px ${brand.bluePale}`,
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 44,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
    },
  },
};

export const SIDEBAR_WIDTH = 110;
export const SIDEBAR_EXPANDED_WIDTH = 248;
export const HEADER_HEIGHT = 65;
