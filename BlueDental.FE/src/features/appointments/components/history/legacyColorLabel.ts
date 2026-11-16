import { t } from "@/lib/i18n";

/**
 * The swatches the retired "Màu lịch hẹn" picker offered (gone with R-1240's
 * "Gán sao"). Older history entries still record one, so their names stay.
 */
const LEGACY_COLORS = [
  { value: "#6366f1", labelKey: "Appointment:Color:Purple" },
  { value: "#22C55E", labelKey: "Appointment:Color:Green" },
  { value: "#F59E0B", labelKey: "Appointment:Color:Orange" },
  { value: "#EF4444", labelKey: "Appointment:Color:Red" },
] as const;

/** The old picker's name for a stored colour ("Xanh lá"), or null for one it did not offer. */
export function appointmentColorLabel(value: string): string | null {
  const match = LEGACY_COLORS.find((c) => c.value.toLowerCase() === value.toLowerCase());
  return match ? t(match.labelKey) : null;
}
