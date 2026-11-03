import { useAuthStore } from "@/features/auth/store/authStore";
import { ReceiptPage } from "@/features/billing/pages/ReceiptPage";
import { t } from "@/lib/i18n";

/**
 * /billing/receipts/:id — Tài chính → Phiếu thu, headed with the clinic's own
 * logo and name as the app header shows them. Composed here because billing
 * may not import the auth feature.
 */
export function ReceiptRoute() {
  const clinicName = useAuthStore((s) => s.user?.clinicName) ?? t("App:DefaultClinic");
  const logoUrl = useAuthStore((s) => s.user?.clinicLogoUrl) ?? "/logo.png";
  return <ReceiptPage clinic={{ name: clinicName, logoUrl }} />;
}
