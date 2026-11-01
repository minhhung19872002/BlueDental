import type { ReactNode } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboWarrantyToothForm } from "./LaboWarrantyToothForm";
import { LaboWarrantyToothPicker } from "./LaboWarrantyToothPicker";
import { restorationName } from "./laboWarrantyRules";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";

interface Props {
  order: LaboOrderDto;
  warranty: LaboWarrantyForm;
  /** The right column: the teeth's cards as they stand. */
  aside: ReactNode;
}

/**
 * Kích hoạt bảo hành in the three columns of the Labo 3 mock: 1. pick the
 * teeth on the left, 2. one card form per picked tooth in the middle, the
 * cards on the right.
 */
export function LaboWarrantyActivationBox({ order, warranty, aside }: Props) {
  const restoration = restorationName(order);
  const caption = [restoration, order.orderCode].filter(Boolean).join(" · ");
  const picked = warranty.pending.filter((tooth) => warranty.open && warranty.selected.includes(tooth.toothNumber));

  return (
    <section className="pd-labo-flow-main pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--teeth">
        <LaboWarrantyToothPicker
          teeth={warranty.pending}
          restoration={restoration}
          selected={warranty.selected}
          open={warranty.open}
          disabled={warranty.busy}
          onToggle={warranty.toggle}
        />
      </div>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--main">
        {/* Mounted even with nothing picked, so the form instance stays connected. */}
        <Form form={warranty.form} layout="vertical" className="pd-labo-form" disabled={warranty.busy}>
          {picked.length > 0 && (
            <div className="pd-labo-warranty-step">
              <h4 className="pd-labo-warranty-step-title">
                <span className="pd-labo-check-badge">2</span>
                {t("Labo:Warranty:FormTitle")}
              </h4>
              {picked.map((tooth) => (
                <LaboWarrantyToothForm
                  key={tooth.toothNumber}
                  tooth={tooth}
                  caption={caption}
                  photos={warranty.photos}
                  busy={warranty.busy}
                />
              ))}
            </div>
          )}
        </Form>
      </div>
      <aside className="pd-labo-flow-pane pd-labo-flow-pane--aside">{aside}</aside>
    </section>
  );
}
