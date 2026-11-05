import { Checkbox } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE } from "@/features/labo/api/laboStatus";
import { LaboWarrantyCardFields } from "./LaboWarrantyCardFields";
import { LaboWarrantyReadiness } from "./LaboWarrantyReadiness";
import { LaboWarrantyToothForm, toothCaption } from "./LaboWarrantyToothForm";
import { LaboWarrantyToothInfo } from "./LaboWarrantyToothInfo";
import { LaboWarrantyToothNav } from "./LaboWarrantyToothNav";
import { latestPassedDay, SHARED_CARD } from "./laboWarrantyRules";
import type { LaboWarrantyForm } from "./useLaboWarrantyForm";
import type { WarrantyActiveTooth } from "./useWarrantyActiveTooth";

interface Props {
  warranty: LaboWarrantyForm;
  /** The picked teeth, one card each. */
  picked: LaboOrderToothDto[];
  /** "Sứ Zirconia". */
  restoration: string;
  /** "Sứ Zirconia · LABO-202610291". */
  caption: string;
  /** The tooth whose card form is open. */
  active: WarrantyActiveTooth;
  /** Under Dùng chung, the tooth whose serial row was jumped to last. */
  focused: number | null;
}

function ShareBox({ warranty, active }: Pick<Props, "warranty" | "active">) {
  const { sharing } = warranty;
  return (
    <div className={["pd-labo-warranty-share", sharing.on && "pd-labo-warranty-share--on"].filter(Boolean).join(" ")}>
      <Checkbox
        checked={sharing.on}
        disabled={warranty.busy}
        onChange={(event) => sharing.set(event.target.checked, active.active)}
      >
        {t("Labo:Warranty:Share")}
      </Checkbox>
      {!sharing.on && <span className="pd-labo-warranty-share-hint">{t("Labo:Warranty:ShareHintOff")}</span>}
    </div>
  );
}

/** Dùng chung: one form for the start, duration, conditions and photos, then each tooth's serial. */
function SharedBody({ warranty, picked, caption, focused }: Props) {
  return (
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
      {picked.map((tooth) => (
        <LaboWarrantyToothForm
          key={tooth.toothNumber}
          tooth={tooth}
          caption={caption}
          photos={warranty.photos}
          sharing={warranty.sharing}
          busy={warranty.busy}
          focused={focused === tooth.toothNumber}
        />
      ))}
    </>
  );
}

/**
 * 2. Thẻ bảo hành (BA mock BaoHanhV2, R-1152): the open tooth's card — titled
 * "Thẻ bảo hành · Răng n", the tooth as it was made, its form, then ‹ Răng
 * trước · Răng tiếp theo ›. With Dùng chung 1 thông số ticked (two teeth or
 * more), one form for them all, then each tooth's serial.
 */
export function LaboWarrantyCardsSection(props: Props) {
  const { warranty, picked, restoration, caption, active } = props;
  const { sharing } = warranty;
  const canShare = picked.length > 1 || sharing.on;
  const tooth = picked.find((each) => each.toothNumber === active.active) ?? picked[0];
  const teeth = picked.map((each) => t("Labo:Warranty:ToothShort", each.toothNumber)).join(", ");
  const allReady = warranty.readyCount === picked.length;

  return (
    <div className="pd-labo-warranty-step">
      <header className="pd-labo-wsection-head">
        <h4 className="pd-labo-warranty-step-title">
          <span className="pd-labo-check-badge">2</span>
          {sharing.on
            ? t("Labo:Warranty:SharedTitle", teeth)
            : t("Labo:Warranty:ToothTitle", t("Labo:Check:ToothLabel", tooth.toothNumber))}
        </h4>
        <span className="pd-labo-warranty-step-caption">
          {sharing.on
            ? [caption, t("Labo:Warranty:CardsHint", picked.length)].join(" · ")
            : toothCaption(caption, tooth)}
        </span>
        {sharing.on ? (
          <StatusBadge
            label={t("Labo:Warranty:ReadyCount", warranty.readyCount, picked.length)}
            {...(allReady ? LABO_PILL_TONE.success : LABO_PILL_TONE.warning)}
          />
        ) : (
          <LaboWarrantyReadiness card={sharing.cardOf(tooth.toothNumber)} />
        )}
      </header>
      {canShare && <ShareBox warranty={warranty} active={active} />}
      {sharing.on ? (
        <SharedBody {...props} />
      ) : (
        <>
          <LaboWarrantyToothInfo tooth={tooth} restoration={restoration} />
          <LaboWarrantyToothForm
            key={tooth.toothNumber}
            tooth={tooth}
            caption={null}
            photos={warranty.photos}
            sharing={sharing}
            busy={warranty.busy}
            focused={false}
          />
          <LaboWarrantyToothNav active={active} />
        </>
      )}
    </div>
  );
}
