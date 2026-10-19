import type { ThemeConfig } from "antd";

import { t } from "@/lib/i18n";
export const brand = {
  /* Đức Hạnh Premium v3 — neon grape, flat; grape-tinted neutrals and the
     four-step status colours. Kept in sync with the --bd-* tokens in
     src/styles/index.css (R-988). */
  blue: "#7b2ef0",
  blueDark: "#6620cc",
  blueMid: "#7b2ef0",
  blueLight: "#c4a3ff",
  bluePale: "#eee5ff",
  bluePaleHover: "#dcc8ff",
  /* grape-50: the tint under the pointer. */
  hoverTint: "#f7f3ff",
  greenPale: "#e3f6ec",
  amberPale: "#fff1de",
  redPale: "#fde7ea",
  purplePale: "#f6ebfc",
  navy: "#3a1178",
  ink: "#1c1a23",
  body: "#2e2b38",
  title: "#1c1a23",
  primary: "#7b2ef0",
  /* grape-800: text on a grape-100 tint (selected item, active page). */
  primaryInk: "#4f17a0",
  accent: "#a875ff",
  violet: "#9147ff",
  sub: "#454152",
  muted: "#5e5a6e",
  faint: "#a9a5b8",
  dim: "#7e7a8f",
  line: "#e6e4ee",
  lineSoft: "#f3f2f7",
  border: "#e6e4ee",
  borderStrong: "#d2cfdd",
  bg: "#faf9fc",
  bgSoft: "#f3f2f7",
  bgHead: "#f3f2f7",
  gold: "#b4691a",
  goldDeep: "#b4691a",
  red: "#c9455a",
  redDark: "#a33447",
  amber: "#b4691a",
  green: "#2e8a5e",
  greenBright: "#2e8a5e",
  teal: "#2f78b5",
  info: "#2f78b5",
  purple: "#9c5caf",
  pink: "#bf5a8c",
  success: "#2e8a5e",
  /* The *-border step of each status colour (dots, chart fills). */
  greenLine: "#9fddbc",
  redLine: "#f4a9b4",
  purpleLine: "#ddb6f2",
  /* v3 categorical families, never a state (R-991). */
  aqua: "#0f7c74",
  aquaPale: "#e3f7f5",
  lavender: "#5b6fc9",
  lavenderPale: "#eef0ff",
  lavenderLine: "#bfc6f7",
  gold200: "#ffe2a6",
  gold500: "#f0a72a",
} as const;

/* The single CTA fill: primary buttons. v3 is flat, so it is the solid grape;
   the name stays for its callers. */
export const CTA_GRADIENT = brand.primary;

export const statusPaletteOf = () => ({
  scheduled: { label: t("Common:Status:Scheduled"), bg: brand.bluePale, color: brand.blue },
  confirmed: { label: t("Common:Status:Confirmed"), bg: brand.greenPale, color: brand.green },
  inProgress: { label: t("Common:Status:InProgress"), bg: brand.amberPale, color: brand.amber },
  completed: { label: t("Common:Status:Completed"), bg: brand.greenPale, color: brand.green },
  cancelled: { label: t("Common:Status:Cancelled"), bg: brand.redPale, color: brand.red },
  noShow: { label: t("Common:Status:NoShow"), bg: brand.purplePale, color: brand.purple },
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
    colorBorder: brand.borderStrong,
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
      itemColor: brand.sub,
      itemHoverBg: brand.hoverTint,
      itemHoverColor: brand.primary,
      itemSelectedBg: brand.bluePale,
      itemSelectedColor: brand.primaryInk,
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
      boxShadowTertiary: "0 2px 10px rgba(28,26,35,.05)",
    },
    Breadcrumb: {
      fontSize: 12.5,
      itemColor: brand.faint,
      lastItemColor: brand.ink,
      separatorColor: brand.line,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
      borderRadius: 10,
      controlHeight: 40,
      controlHeightLG: 46,
      defaultBorderColor: brand.borderStrong,
      defaultColor: brand.body,
    },
    Input: {
      /* v3 focus ring: 2px grape-300 outside the control. */
      activeShadow: `0 0 0 2px ${brand.blueLight}`,
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
      boxShadow: "0 24px 60px rgba(28,26,35,.18)",
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
    /* v3: a neutral-100 track with a white chip and grape-800 text. */
    Segmented: {
      itemSelectedBg: "#ffffff",
      itemSelectedColor: brand.primaryInk,
      itemColor: brand.muted,
      trackBg: brand.bgSoft,
      trackPadding: 4,
      borderRadius: 12,
    },
    /* The current page is a tint, never a second solid fill (v3). */
    Pagination: {
      itemActiveBg: brand.bluePale,
      itemActiveColor: brand.primaryInk,
      borderRadius: 10,
    },
  },
};

/* The reference app gave the voucher dialog a brighter blue than the rest of
   the screens; v2 and v3 do not, so this is the ordinary primary. Kept as its
   own name because the dialog still themes itself, in sync with --vc-accent in
   features/voucher/components/voucher.css. */
const voucherAccent = brand.primary;

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
      itemSelectedBg: "#ffffff",
      itemSelectedColor: brand.primaryInk,
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

export const HEADER_HEIGHT = 62;

export const statusPalette = {
  scheduled: { label: "Đã đặt lịch", bg: brand.bluePale, color: brand.blue },
  confirmed: { label: "Đã xác nhận", bg: brand.greenPale, color: brand.green },
  inProgress: { label: "Đang khám", bg: brand.amberPale, color: brand.amber },
  completed: { label: "Hoàn thành", bg: brand.greenPale, color: brand.green },
  cancelled: { label: "Đã hủy", bg: brand.redPale, color: brand.redDark },
  noShow: { label: "Không đến", bg: brand.purplePale, color: brand.purple },
} as const;
