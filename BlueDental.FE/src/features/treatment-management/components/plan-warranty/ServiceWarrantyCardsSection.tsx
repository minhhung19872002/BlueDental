import { Checkbox } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import { LaboWarrantyCardFields } from "@/features/labo/components/warranty/LaboWarrantyCardFields";
import { SHARED_CARD } from "@/features/labo/components/warranty/laboWarrantyRules";
import { t } from "@/lib/i18n";
import type { WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { catalogDaysOf, completedDay, completedOnText } from "./serviceWarrantyRules";
import { ServiceWarrantyToothForm } from "./ServiceWarrantyToothForm";
import type { ServiceWarrantyForm } from "./useServiceWarrantyForm";

interface Props {
  warranty: ServiceWarrantyForm;
  row: WarrantyServiceRowDto;
  /** The picked teeth, one card each; [NO_TOOTH] on a line without teeth. */
  picked: number[];
  /** The tooth whose row in 1. was pressed last. */
  focused: number | null;
}

/** Dùng chung on: the one form, and the teeth it is for. A dental card has no serial to type per tooth. */
function SharedCard({ warranty, row, picked }: Omit<Props, "focused">) {
  return (
    <>
      <p className="pd-labo-warranty-share-note">{t("Treatment:Warranty:ShareHintOn", picked.length)}</p>
      <section className="pd-labo-warranty-shared" aria-label={t("Labo:Warranty:Share")}>
        <LaboWarrantyCardFields
          path={["shared"]}
          minDay={completedDay(row)}
          serial="none"
          photos={warranty.photos}
          photoKey={SHARED_CARD}
          busy={warranty.busy}
          catalogDays={catalogDaysOf(row)}
        />
      </section>
      <div className="pd-labo-warranty-preview-teeth">
        <span>{t("Treatment:Warranty:AppliesTo")}</span>
        <ul>
          {picked.map((tooth) => (
            <li key={tooth}>{t("Labo:Check:ToothLabel", tooth)}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * 2. Thẻ bảo hành: a card form per picked tooth — or, with Dùng chung 1 thông
 * số ticked (two teeth or more), one form for the start, duration, conditions
 * and photos of them all.
 */
export function ServiceWarrantyCardsSection({ warranty, row, picked, focused }: Props) {
  const { sharing, hasTeeth } = warranty;
  const canShare = picked.length > 1 || sharing.on;
  const allReady = warranty.readyCount === picked.length;
  const teeth = picked.map((tooth) => t("Labo:Warranty:ToothShort", tooth)).join(", ");

  return (
    <div className="pd-labo-warranty-step">
      {hasTeeth && (
        <h4 className="pd-labo-warranty-step-title">
          <span className="pd-labo-check-badge">2</span>
          {sharing.on ? t("Labo:Warranty:SharedTitle", teeth) : t("Labo:Warranty:FormTitle")}
          {sharing.on && (
            <span className="pd-labo-warranty-step-caption">
              {[row.serviceName, completedOnText(row)].filter(Boolean).join(" · ")}
            </span>
          )}
        </h4>
      )}
      {sharing.on && (
        <StatusBadge
          label={t("Labo:Warranty:ReadyCount", warranty.readyCount, picked.length)}
          {...(allReady ? LABO_PILL_TONE.success : LABO_PILL_TONE.warning)}
        />
      )}
      {canShare && (
        <div className={["pd-labo-warranty-share", sharing.on && "pd-labo-warranty-share--on"].filter(Boolean).join(" ")}>
          <Checkbox checked={sharing.on} disabled={warranty.busy} onChange={(event) => sharing.set(event.target.checked)}>
            {t("Labo:Warranty:Share")}
          </Checkbox>
          {!sharing.on && <span className="pd-labo-warranty-share-hint">{t("Labo:Warranty:ShareHintOff")}</span>}
        </div>
      )}
      {sharing.on ? (
        <SharedCard warranty={warranty} row={row} picked={picked} />
      ) : (
        picked.map((tooth) => (
          <ServiceWarrantyToothForm
            key={tooth}
            tooth={tooth}
            row={row}
            photos={warranty.photos}
            busy={warranty.busy}
            focused={focused === tooth}
          />
        ))
      )}
    </div>
  );
}
