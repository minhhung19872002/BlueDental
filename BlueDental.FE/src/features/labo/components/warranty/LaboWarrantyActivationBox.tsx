import type { ReactNode } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboWarrantyCardsSection } from "./LaboWarrantyCardsSection";
import { LaboWarrantySharedPreview } from "./LaboWarrantySharedPreview";
import { LaboWarrantyToothPicker } from "./LaboWarrantyToothPicker";
import { restorationName } from "./laboWarrantyRules";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";
import { useWarrantyToothJump } from "./useWarrantyToothJump";

interface Props {
  order: LaboOrderDto;
  warranty: LaboWarrantyForm;
  /** The clinic's logo, for the shared card's preview. */
  logoUrl: string;
  /** The right column: the teeth's cards as they stand, but for those it is told to leave out. */
  aside: (leaveOut: number[]) => ReactNode;
}

/**
 * Kích hoạt bảo hành in the three columns of the Labo 3 mock: 1. pick the
 * teeth on the left, 2. one card form per picked tooth in the middle, the
 * cards on the right — with Dùng chung, the picked teeth's one card first.
 */
export function LaboWarrantyActivationBox({ order, warranty, logoUrl, aside }: Props) {
  const restoration = restorationName(order);
  const caption = [restoration, order.orderCode].filter(Boolean).join(" · ");
  const jump = useWarrantyToothJump();
  const picked = warranty.pending.filter((tooth) => warranty.open && warranty.selected.includes(tooth.toothNumber));
  const pickedNumbers = picked.map((tooth) => tooth.toothNumber);

  return (
    <section className="pd-labo-flow-main pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--teeth">
        <LaboWarrantyToothPicker warranty={warranty} restoration={restoration} jump={jump} />
      </div>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--main">
        {/* Mounted even with nothing picked, so the form instance stays connected. */}
        <Form form={warranty.form} layout="vertical" className="pd-labo-form" disabled={warranty.busy}>
          {picked.length > 0 && (
            <LaboWarrantyCardsSection warranty={warranty} picked={picked} caption={caption} focused={jump.focused} />
          )}
        </Form>
      </div>
      <aside className="pd-labo-flow-pane pd-labo-flow-pane--aside">
        {warranty.sharing.on && picked.length > 0 ? (
          <>
            <LaboWarrantySharedPreview
              teeth={pickedNumbers}
              card={warranty.sharing.cardOf(pickedNumbers[0])}
              what={[restoration, order.supplierName].filter(Boolean).join(" · ")}
              logoUrl={logoUrl}
            />
            {aside(pickedNumbers)}
          </>
        ) : (
          aside([])
        )}
      </aside>
    </section>
  );
}
