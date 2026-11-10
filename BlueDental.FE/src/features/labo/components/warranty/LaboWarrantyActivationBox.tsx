import { Form } from "antd";
import { t } from "@/lib/i18n";
import { laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboWarrantyCardsSection } from "./LaboWarrantyCardsSection";
import { LaboWarrantySharedPreview } from "./LaboWarrantySharedPreview";
import { LaboWarrantyToothPicker } from "./LaboWarrantyToothPicker";
import { LaboWarrantyToothPreview } from "./LaboWarrantyToothPreview";
import { restorationName } from "./laboWarrantyRules";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";
import type { WarrantyActiveTooth } from "./useWarrantyActiveTooth";
import { useWarrantyToothJump } from "./useWarrantyToothJump";

interface Props {
  order: LaboOrderDto;
  warranty: LaboWarrantyForm;
  /** The clinic's logo, for the card's preview. */
  logoUrl: string;
  /** The picked tooth whose card form is open — kept by the step, so Tổng quan's "Chỉnh sửa" can open it. */
  active: WarrantyActiveTooth;
}

/**
 * Kích hoạt bảo hành in three columns (BA mock BaoHanhV2, R-1152): 1. pick the
 * teeth on the left, 2. the open tooth's card form in the middle, its card's
 * preview on the right — with Dùng chung, the picked teeth's one card.
 */
export function LaboWarrantyActivationBox({ order, warranty, logoUrl, active }: Props) {
  const restoration = restorationName(order);
  const caption = [restoration, laboOrderNo(order)].filter(Boolean).join(" · ");
  const what = [restoration, order.supplierName].filter(Boolean).join(" · ");
  const jump = useWarrantyToothJump();
  const picked = warranty.pending.filter((tooth) => warranty.open && warranty.selected.includes(tooth.toothNumber));
  const pickedNumbers = picked.map((tooth) => tooth.toothNumber);
  const { sharing } = warranty;

  return (
    <section className="pd-labo-flow-main pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--teeth">
        <LaboWarrantyToothPicker warranty={warranty} restoration={restoration} jump={jump} active={active} />
      </div>
      <div className="pd-labo-flow-pane pd-labo-flow-pane--main">
        {/* Mounted even with nothing picked, so the form instance stays connected. */}
        <Form form={warranty.form} layout="vertical" className="pd-labo-form" disabled={warranty.busy}>
          {picked.length > 0 && (
            <LaboWarrantyCardsSection
              warranty={warranty}
              picked={picked}
              restoration={restoration}
              caption={caption}
              active={active}
              focused={jump.focused}
            />
          )}
        </Form>
      </div>
      <aside className="pd-labo-flow-pane pd-labo-flow-pane--aside">
        {sharing.on && picked.length > 0 ? (
          <LaboWarrantySharedPreview
            teeth={pickedNumbers}
            card={sharing.cardOf(pickedNumbers[0])}
            what={what}
            logoUrl={logoUrl}
            wording={{
              code: t("Labo:Warranty:SharedCodeEach", picked.length),
              pill: t("Labo:Warranty:ReadyOfShort", warranty.readyCount, picked.length),
            }}
          />
        ) : (
          <LaboWarrantyToothPreview
            card={active.active == null ? undefined : sharing.cardOf(active.active)}
            what={what}
            logoUrl={logoUrl}
            teeth={pickedNumbers}
            active={active}
          />
        )}
      </aside>
    </section>
  );
}
