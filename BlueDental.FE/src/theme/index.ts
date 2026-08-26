import type { ThemeConfig } from "antd";

import { t } from "@/lib/i18n";
export const brand = {
  blue: "#1c3566",
  blueDark: "#142a54",
  blueMid: "#1c3566",
  blueLight: "#6f8ec4",
  bluePale: "#e7f0fb",
  greenPale: "#e6f5ef",
  amberPale: "#fdf3e2",
  redPale: "#fdeeee",
  purplePale: "#efedf6",
  navy: "#1b2a41",
  ink: "#1b2a41",
  body: "#1b2a41",
  primary: "#1c3566",
  sub: "#41505f",
  muted: "#5a6b82",
  faint: "#98a4b4",
  dim: "#7d8a9c",
  line: "#dce3ee",
  lineSoft: "#eef2f7",
  border: "#dce3ee",
  bg: "#f6f8fb",
  bgSoft: "#fafbfd",
  bgHead: "#fafbfd",
  gold: "#f4b740",
  goldDeep: "#dd9426",
  red: "#e5484d",
  redDark: "#d43b3b",
  amber: "#dd9426",
  green: "#2bb673",
  greenBright: "#25a97a",
  teal: "#3d7fa8",
  purple: "#6f63a3",
  pink: "#bf5a8c",
  success: "#2bb673",
} as const;

export const statusPaletteOf = () => ({
  scheduled: { label: t("Đã đặt lịch"), bg: brand.bluePale, color: brand.blue },
  confirmed: { label: t("Đã xác nhận"), bg: brand.greenPale, color: brand.green },
  inProgress: { label: t("Đang khám"), bg: brand.amberPale, color: brand.amber },
  completed: { label: t("Hoàn thành"), bg: brand.greenPale, color: brand.green },
  cancelled: { label: t("Đã hủy"), bg: brand.redPale, color: brand.red },
  noShow: { label: t("Không đến"), bg: brand.purplePale, color: brand.purple },
});

export const FONT_FAMILY =
  "'Google Sans', 'Be Vietnam Pro', system-ui, -apple-system, sans-serif";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: brand.blue,
    colorLink: brand.blue,
    colorLinkHover: "#2c3e50",
    colorInfo: brand.blue,
    colorSuccess: brand.success,
    colorWarning: brand.goldDeep,
    colorError: brand.red,
    colorTextBase: brand.ink,
    colorBorder: brand.line,
    colorBorderSecondary: brand.border,
    controlHeight: 40,
    borderRadius: 8,
    fontFamily: FONT_FAMILY,
    colorBgLayout: brand.bg,
    fontSize: 13,
  },
  components: {
    Layout: {
      siderBg: "#1b2a41",
      headerBg: "#ffffff",
      bodyBg: brand.bg,
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemColor: "#93a3ba",
      itemHoverBg: "rgba(255,255,255,.08)",
      itemHoverColor: "#ffffff",
      itemSelectedBg: brand.blue,
      itemSelectedColor: "#ffffff",
      itemHeight: 40,
      itemBorderRadius: 11,
      iconSize: 19,
    },
    Table: {
      headerBg: brand.bgHead,
      headerColor: brand.muted,
      headerSplitColor: "transparent",
      rowHoverBg: brand.bgSoft,
      borderColor: brand.lineSoft,
      cellFontSize: 12.5,
      cellPaddingBlock: 12,
      cellPaddingInline: 14,
      headerBorderRadius: 0,
    },
    Card: {
      paddingLG: 20,
      colorBorderSecondary: brand.border,
      borderRadiusLG: 12,
      boxShadowTertiary: "0 1px 2px rgba(38,113,216,.06)",
    },
    Breadcrumb: {
      fontSize: 12.5,
      itemColor: brand.faint,
      lastItemColor: brand.ink,
      separatorColor: brand.line,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: "0 2px 6px rgba(27,42,65,.06)",
      defaultShadow: "none",
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 46,
      defaultBorderColor: brand.line,
      defaultColor: brand.body,
    },
    Input: {
      activeShadow: "0 0 0 3px rgba(38,113,216,.25)",
      activeBorderColor: brand.blue,
      hoverBorderColor: brand.blue,
      borderRadius: 8,
      controlHeight: 40,
      controlHeightLG: 48,
      colorBgContainer: "#ffffff",
    },
    Select: {
      borderRadius: 8,
      controlHeight: 40,
      optionSelectedBg: brand.bluePale,
    },
    Modal: {
      borderRadiusLG: 12,
      headerBg: "#ffffff",
      contentBg: "#ffffff",
      boxShadow: "0 12px 32px rgba(27,42,65,.12)",
    },
    Drawer: {
      colorBgElevated: "#ffffff",
    },
    Tag: {
      borderRadiusSM: 20,
      defaultBg: brand.bgSoft,
      defaultColor: brand.sub,
    },
    Tabs: {
      itemColor: brand.muted,
      itemSelectedColor: brand.blue,
      itemHoverColor: brand.blue,
      inkBarColor: brand.blue,
      titleFontSize: 13,
    },
    Segmented: {
      itemSelectedBg: brand.blue,
      itemSelectedColor: "#ffffff",
      itemColor: brand.muted,
      trackBg: brand.bg,
      trackPadding: 4,
      borderRadius: 10,
    },
    Pagination: {
      itemActiveBg: brand.blue,
      borderRadius: 8,
    },
  },
};

export const SIDEBAR_WIDTH = 76;
export const SIDEBAR_EXPANDED_WIDTH = 236;
export const HEADER_HEIGHT = 66;

export const statusPalette = {
  scheduled: { label: "Đã đặt lịch", bg: "#E3F2FD", color: "#1565C0" },
  confirmed: { label: "Đã xác nhận", bg: "#E8F5E9", color: "#2E7D32" },
  inProgress: { label: "Đang khám", bg: "#FFF8E1", color: "#E65100" },
  completed: { label: "Hoàn thành", bg: "#E8F5E9", color: "#2E7D32" },
  cancelled: { label: "Đã hủy", bg: "#FFEBEE", color: "#C62828" },
  noShow: { label: "Không đến", bg: "#F3E5F5", color: "#6A1B9A" },
} as const;
