import type { ThemeConfig } from "antd";

import { t } from "@/lib/i18n";
export const brand = {
  /* Đức Hạnh Premium v2 — indigo primary, cyan accent.
     Kept in sync with the --bd-* tokens in src/styles/index.css. */
  blue: "#6366f1",
  blueDark: "#4f46e5",
  blueMid: "#6366f1",
  blueLight: "#a5b4fc",
  bluePale: "#eef0ff",
  greenPale: "#e3f6ef",
  amberPale: "#fbf1de",
  redPale: "#fdeced",
  purplePale: "#f0ebfc",
  navy: "#232a56",
  ink: "#171c33",
  body: "#171c33",
  title: "#22285c",
  primary: "#6366f1",
  accent: "#22d3ee",
  violet: "#8b5cf6",
  sub: "#414a6b",
  muted: "#5c6484",
  faint: "#99a0bd",
  dim: "#7d85a5",
  line: "#e7eaf6",
  lineSoft: "#f0f2fa",
  border: "#e7eaf6",
  bg: "#eef1fb",
  bgSoft: "#f7f8fd",
  bgHead: "#f7f8fd",
  gold: "#d98b0f",
  goldDeep: "#d98b0f",
  red: "#e5484d",
  redDark: "#cf3c41",
  amber: "#d98b0f",
  green: "#0e9f6e",
  greenBright: "#0e9f6e",
  teal: "#0e94d0",
  info: "#0e94d0",
  purple: "#7c5ce0",
  pink: "#bf5a8c",
  success: "#0e9f6e",
} as const;

/* The single CTA fill: primary buttons and the active nav pill. */
export const CTA_GRADIENT =
  "linear-gradient(120deg, #6366f1, #8b5cf6 55%, #22d3ee 130%)";

export const statusPaletteOf = () => ({
  scheduled: { label: t("Đã đặt lịch"), bg: brand.bluePale, color: brand.blue },
  confirmed: { label: t("Đã xác nhận"), bg: brand.greenPale, color: brand.green },
  inProgress: { label: t("Đang khám"), bg: brand.amberPale, color: brand.amber },
  completed: { label: t("Hoàn thành"), bg: brand.greenPale, color: brand.green },
  cancelled: { label: t("Đã hủy"), bg: brand.redPale, color: brand.red },
  noShow: { label: t("Không đến"), bg: brand.purplePale, color: brand.purple },
});

export const FONT_FAMILY =
  "'Be Vietnam Pro', system-ui, -apple-system, sans-serif";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: brand.blue,
    colorLink: brand.blue,
    colorLinkHover: brand.blueDark,
    colorInfo: brand.blue,
    colorSuccess: brand.success,
    colorWarning: brand.goldDeep,
    colorError: brand.red,
    colorTextBase: brand.ink,
    colorBorder: brand.line,
    colorBorderSecondary: brand.border,
    controlHeight: 40,
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    colorBgLayout: brand.bg,
    fontSize: 13,
    /*
     * The fill behind a chosen item in a dropdown or a menu, and the deeper one
     * for when that item is also hovered.
     *
     * Only `optionSelectedBg` had been set, so hovering a chosen option fell
     * through to Ant Design's default grey — visible as a slab across the
     * Hành động list, where every option is chosen to begin with.
     */
    controlItemBgActive: brand.bluePale,
    controlItemBgActiveHover: brand.bluePale,
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
      itemColor: "#b9c2dd",
      itemHoverBg: "rgba(255,255,255,.08)",
      itemHoverColor: "#ffffff",
      itemSelectedBg: brand.blue,
      itemSelectedColor: "#ffffff",
      itemHeight: 40,
      itemBorderRadius: 14,
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
      borderRadiusLG: 20,
      boxShadowTertiary: "0 2px 10px rgba(35,42,86,.05)",
    },
    Breadcrumb: {
      fontSize: 12.5,
      itemColor: brand.faint,
      lastItemColor: brand.ink,
      separatorColor: brand.line,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: "0 10px 30px rgba(99,102,241,.28)",
      defaultShadow: "none",
      borderRadius: 10,
      controlHeight: 40,
      controlHeightLG: 46,
      defaultBorderColor: brand.line,
      defaultColor: brand.body,
    },
    Input: {
      activeShadow: "0 0 0 3px rgba(99,102,241,.22)",
      activeBorderColor: brand.blue,
      hoverBorderColor: brand.blue,
      borderRadius: 10,
      controlHeight: 40,
      controlHeightLG: 48,
      colorBgContainer: "#ffffff",
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
      optionSelectedBg: brand.bluePale,
    },
    Modal: {
      borderRadiusLG: 18,
      headerBg: "#ffffff",
      contentBg: "#ffffff",
      boxShadow: "0 24px 60px rgba(35,42,86,.18)",
    },
    Drawer: {
      colorBgElevated: "#ffffff",
    },
    Tag: {
      borderRadiusSM: 999,
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
      borderRadius: 12,
    },
    Pagination: {
      itemActiveBg: brand.blue,
      borderRadius: 10,
    },
  },
};

/* The reference app gave the voucher dialog a brighter blue than the rest of
   the screens; v2 does not, so this is now the ordinary primary. Kept as its
   own name because the dialog still themes itself, in sync with --vc-accent in
   features/voucher/components/voucher.css. */
const voucherAccent = "#6366f1";

export const voucherDialogTheme: ThemeConfig = {
  token: {
    colorPrimary: voucherAccent,
    colorInfo: voucherAccent,
    colorLink: voucherAccent,
  },
  components: {
    Tabs: {
      itemSelectedColor: voucherAccent,
      itemHoverColor: voucherAccent,
      inkBarColor: voucherAccent,
      titleFontSize: 14,
    },
    Segmented: {
      itemSelectedBg: voucherAccent,
      itemSelectedColor: "#ffffff",
      itemColor: brand.muted,
      trackBg: brand.lineSoft,
      trackPadding: 4,
      borderRadius: 8,
    },
    Input: {
      activeBorderColor: voucherAccent,
      hoverBorderColor: voucherAccent,
      activeShadow: "none",
    },
    InputNumber: {
      activeBorderColor: voucherAccent,
      hoverBorderColor: voucherAccent,
      activeShadow: "none",
    },
    DatePicker: {
      activeBorderColor: voucherAccent,
      hoverBorderColor: voucherAccent,
      activeShadow: "none",
    },
    Select: {
      activeBorderColor: voucherAccent,
      hoverBorderColor: voucherAccent,
      activeOutlineColor: "transparent",
    },
  },
};

export const SIDEBAR_WIDTH = 76;
export const SIDEBAR_EXPANDED_WIDTH = 236;
export const HEADER_HEIGHT = 66;

export const statusPalette = {
  scheduled: { label: "Đã đặt lịch", bg: "#eef0ff", color: "#6366f1" },
  confirmed: { label: "Đã xác nhận", bg: "#e3f6ef", color: "#0e9f6e" },
  inProgress: { label: "Đang khám", bg: "#faf1e2", color: "#d98b0f" },
  completed: { label: "Hoàn thành", bg: "#e3f6ef", color: "#0e9f6e" },
  cancelled: { label: "Đã hủy", bg: "#fce9ea", color: "#cf3c41" },
  noShow: { label: "Không đến", bg: "#efebfb", color: "#7c5ce0" },
} as const;
