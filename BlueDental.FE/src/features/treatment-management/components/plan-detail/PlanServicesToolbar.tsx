import { Pill, Plus, Printer, Receipt } from "lucide-react";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";

interface Props {
  /**
   * A finished slip takes no new service line — the server refuses it, so the
   * button is not offered on such a slip.
   */
  canAddService: boolean;
  onAddService: () => void;
  onPrescription: () => void;
  onInvoice: () => void;
  onPrint: () => void;
}

/**
 * The strip above the service table: "Thêm dịch vụ phát sinh" on the left,
 * the prescription, invoice and print buttons on the right. The printer icon
 * opens the slip's "Chi tiết phiếu".
 *
 * "Thêm dịch vụ phát sinh" opens "Tạo phiếu dịch vụ" on this slip. It took
 * the place of the inline service picker, and "Thêm công đoạn" left the strip
 * (owner 2026-10-15) — công đoạn are still added from the slip list.
 */
export function PlanServicesToolbar({
  canAddService,
  onAddService,
  onPrescription,
  onInvoice,
  onPrint,
}: Props) {
  const rxAbility = useAbility("prescription");
  // "In Hóa Đơn" opens "Tạo phiếu thanh toán" on this slip (owner 2026-10-12) — payment.create.
  const canCreatePayment = useAbility("payment").canCreate;

  return (
    <div className="pdt-toolbar">
      <div className="pdt-toolbar-start">
        {canAddService && (
          <button type="button" className="tp-btn tp-btn--primary" onClick={onAddService}>
            <Plus size={16} aria-hidden="true" />
            {t("Treatment:Plan:AddExtraService")}
          </button>
        )}
      </div>
      <div className="pdt-toolbar-end">
        {rxAbility.canCreate && (
          <button type="button" className="tp-btn tp-btn--outline" onClick={onPrescription}>
            <Pill size={16} aria-hidden="true" />
            {t("Treatment:Prescription:CreatePrescriptionButton")}
          </button>
        )}
        {canCreatePayment && (
          <button type="button" className="tp-btn tp-btn--outline" onClick={onInvoice}>
            <Receipt size={16} aria-hidden="true" />
            {t("Treatment:Payment:PrintInvoiceAlt")}
          </button>
        )}
        <button type="button" className="pdt-print" aria-label={t("Treatment:Receipt:TreatmentSlipFor")} onClick={onPrint}>
          <Printer size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
