import { t } from "@/lib/i18n";

/**
 * CallProvider enum mirror. The reference's dialog offers a single provider
 * card — Voip24h — so that is the whole catalogue. Brand name, not translated.
 */
export const CALL_PROVIDERS: { value: number; label: string }[] = [
  { value: 0, label: "Voip24h" },
];

export function providerLabel(provider: number): string {
  return CALL_PROVIDERS.find((p) => p.value === provider)?.label ?? "—";
}

/** How a Trạng thái toggle reads in the tables. */
export function activeTag(isActive: boolean): { label: string; color: string } {
  return isActive
    ? { label: t("Tools:Active"), color: "green" }
    : { label: t("Tools:Inactive"), color: "default" };
}

/**
 * UNKNOWN_REFERENCE_BEHAVIOR: the reference's call list was empty, so its
 * status wording could not be read. These labels mirror the BE's placeholder
 * enum until a real call has been observed.
 */
export function callLogStatusTag(status: number): { label: string; color: string } {
  switch (status) {
    case 0:
      return { label: t("Tools:CallAnswered"), color: "green" };
    case 1:
      return { label: t("Tools:CallMissed"), color: "red" };
    case 2:
      return { label: t("Tools:CallBusy"), color: "orange" };
    default:
      return { label: "—", color: "default" };
  }
}

