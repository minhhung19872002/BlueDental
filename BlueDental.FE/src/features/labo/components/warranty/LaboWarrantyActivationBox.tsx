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
}

/** Kích hoạt bảo hành: 1. pick the teeth, 2. one card form per picked tooth. */
export function LaboWarrantyActivationBox({ order, warranty }: Props) {
  const restoration = restorationName(order);
  const caption = [restoration, order.orderCode].filter(Boolean).join(" · ");
  const picked = warranty.pending.filter((tooth) => warranty.open && warranty.selected.includes(tooth.toothNumber));

  return (
    <section className="pd-labo-warranty-box" aria-label={t("Labo:Warranty:ActivateTitle")}>
      <header className="pd-labo-warranty-box-head">
        <h3>{t("Labo:Warranty:ActivateTitle")}</h3>
        <span className="pd-labo-check-aside">
          {t("Labo:Warranty:ReadyCount", warranty.readyCount, warranty.selected.length)}
        </span>
      </header>
      <LaboWarrantyToothPicker
        teeth={warranty.pending}
        restoration={restoration}
        selected={warranty.selected}
        open={warranty.open}
        disabled={warranty.busy}
        onToggle={warranty.toggle}
      />
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
    </section>
  );
}
