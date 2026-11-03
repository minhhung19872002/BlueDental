import { Checkbox } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import { LaboWarrantyCardFields } from "./LaboWarrantyCardFields";
import { LaboWarrantyToothForm } from "./LaboWarrantyToothForm";
import { latestPassedDay, SHARED_CARD } from "./laboWarrantyRules";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";

interface Props {
  warranty: LaboWarrantyForm;
  /** The picked teeth, one card each. */
  picked: LaboOrderToothDto[];
  /** "Sứ Zirconia · LABO-202610291". */
  caption: string;
  /** The tooth whose row in 1. was pressed last. */
  focused: number | null;
}

/**
 * 2. Thẻ bảo hành: a card form per picked tooth — or, with Dùng chung 1 thông
 * số ticked (BA mock, two teeth or more), one form for the start, duration,
 * conditions and photos of them all, then each tooth's serial.
 */
export function LaboWarrantyCardsSection({ warranty, picked, caption, focused }: Props) {
  const { sharing } = warranty;
  const canShare = picked.length > 1 || sharing.on;
  const allReady = warranty.readyCount === picked.length;
  const teeth = picked.map((tooth) => t("Labo:Warranty:ToothShort", tooth.toothNumber)).join(", ");

  return (
    <div className="pd-labo-warranty-step">
      <h4 className="pd-labo-warranty-step-title">
        <span className="pd-labo-check-badge">2</span>
        {sharing.on ? t("Labo:Warranty:SharedTitle", teeth) : t("Labo:Warranty:FormTitle")}
        {sharing.on && (
          <span className="pd-labo-warranty-step-caption">
            {[caption, t("Labo:Warranty:CardsHint", picked.length)].join(" · ")}
          </span>
        )}
      </h4>
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
      {sharing.on && (
        <>
          <p className="pd-labo-warranty-share-note">{t("Labo:Warranty:ShareHintOn", picked.length)}</p>
          <section className="pd-labo-warranty-shared" aria-label={t("Labo:Warranty:Share")}>
            <LaboWarrantyCardFields
              path={["shared"]}
              minDay={latestPassedDay(picked)}
              serial="elsewhere"
              photos={warranty.photos}
              photoKey={SHARED_CARD}
              busy={warranty.busy}
            />
          </section>
          <h5 className="pd-labo-warranty-serial-title">{t("Labo:Warranty:SerialEach")}</h5>
        </>
      )}
      {picked.map((tooth) => (
        <LaboWarrantyToothForm
          key={tooth.toothNumber}
          tooth={tooth}
          caption={caption}
          photos={warranty.photos}
          sharing={sharing}
          busy={warranty.busy}
          focused={focused === tooth.toothNumber}
        />
      ))}
    </div>
  );
}
