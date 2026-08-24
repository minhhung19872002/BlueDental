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
  "'Google Sans', 'Be Vietnam Pro', system-ui, -apple-system, sans-serif";

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
