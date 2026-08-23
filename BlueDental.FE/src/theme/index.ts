import type { ThemeConfig } from "antd";

import { t } from "@/lib/i18n";
export const brand = {
  blue: "#1c3566",
  blueDark: "#142a54",
  blueMid: "#1c3566",
  blueLight: "#6f8ec4",
  bluePale: "#eaf0fa",
  navy: "#152a52",
  ink: "#101c2c",
  body: "#2c3a4a",
  sub: "#41505f",
  muted: "#6f7c90",
  faint: "#98a4b4",
  dim: "#7d8a9c",
  line: "#e2e8f0",
  lineSoft: "#eef2f7",
  border: "#e7ecf3",
  bg: "#f4f6fa",
  bgSoft: "#fafbfd",
  bgHead: "#fafbfd",
  gold: "#fdbf4f",
  goldDeep: "#dd9426",
  red: "#ef4d4d",
  redDark: "#d43b3b",
  amber: "#dd9426",
  green: "#1f8a63",
  greenBright: "#25a97a",
  teal: "#3d7fa8",
  purple: "#6f63a3",
  pink: "#bf5a8c",
  success: "#1f8a63",
} as const;

export const statusPaletteOf = () => ({
  scheduled: { label: t("Đã đặt lịch"), bg: "#eaf0fa", color: "#1c3566" },
  confirmed: { label: t("Đã xác nhận"), bg: "#e6f5ef", color: "#1f8a63" },
  inProgress: { label: t("Đang khám"), bg: "#fdf3e2", color: "#dd9426" },
  completed: { label: t("Hoàn thành"), bg: "#e6f5ef", color: "#1f8a63" },
  cancelled: { label: t("Đã hủy"), bg: "#fdeeee", color: "#ef4d4d" },
  noShow: { label: t("Không đến"), bg: "#efedf6", color: "#6f63a3" },
});

export const FONT_FAMILY =
  "'Be Vietnam Pro', system-ui, -apple-system, sans-serif";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: brand.blue,
    colorLink: brand.blue,
    colorLinkHover: "#0b4bd6",
    colorInfo: brand.blue,
    colorSuccess: brand.success,
    colorWarning: brand.goldDeep,
    colorError: brand.red,
    colorTextBase: brand.ink,
    colorBorder: brand.line,
    colorBorderSecondary: brand.border,
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    colorBgLayout: brand.bg,
    fontSize: 13,
  },
  components: {
    Layout: {
      siderBg: brand.navy,
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
      borderRadiusLG: 16,
      boxShadowTertiary: "0 1px 2px rgba(29,31,36,.05)",
    },
    Breadcrumb: {
      fontSize: 12.5,
      itemColor: brand.faint,
      lastItemColor: brand.ink,
      separatorColor: brand.line,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: "0 8px 18px -10px rgba(28,53,102,.9)",
      defaultShadow: "none",
      borderRadius: 10,
      controlHeight: 38,
      controlHeightLG: 44,
      defaultBorderColor: brand.line,
      defaultColor: brand.body,
    },
    Input: {
      activeShadow: "none",
      activeBorderColor: brand.blue,
      hoverBorderColor: brand.blue,
      borderRadius: 10,
      controlHeight: 38,
      controlHeightLG: 46,
      colorBgContainer: "#ffffff",
    },
    Select: {
      borderRadius: 10,
      controlHeight: 38,
      optionSelectedBg: brand.bluePale,
    },
    Modal: {
      borderRadiusLG: 18,
      headerBg: "#ffffff",
      contentBg: "#ffffff",
      boxShadow: "0 30px 70px -20px rgba(21,42,82,.5)",
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
      itemSelectedBg: "#ffffff",
      itemSelectedColor: brand.ink,
      trackBg: brand.bg,
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
