import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { LaboOrderDto, LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { LaboTeethHead } from "./LaboTeethHead";
import { LaboToothCheckRow } from "./LaboToothCheckRow";
import { LaboReturnCount, LaboToothSurfaces, LaboToothWarranty } from "./LaboToothCells";
import { passedRoundNo, passedTeeth, teethTally } from "./laboCheckRules";
import type { LaboCheckForm } from "./useLaboCheckForm";

/** "Đạt lần k · đã lắp dd/mm" once its warranty is on, else "Đạt lần k · chờ lắp" (P3110 REQ-D7, G13). */
function passedLabel(order: LaboOrderDto, tooth: LaboOrderToothDto): string {
  const roundNo = passedRoundNo(order, tooth.toothNumber) ?? 1;
  return tooth.warrantyActivatedAt
    ? t("Labo:Check:PassedFitted", roundNo, dayjs(tooth.warrantyActivatedAt).format("DD/MM"))
    : t("Labo:Check:PassedAwaitFit", roundNo);
}

/** A tooth that passed on an earlier delivery: greyed, nothing to pick (m342 Răng 13). */
function PassedToothRow({
  order,
  tooth,
  inCheck,
}: {
  order: LaboOrderDto;
  tooth: LaboOrderToothDto;
  inCheck: boolean;
}) {
  return (
    <li className="pd-labo-tooth-row pd-labo-tooth-row--locked">
      <div className="pd-labo-tooth-line">
        <span className="pd-labo-tooth-no">{t("Labo:Check:ToothLabel", tooth.toothNumber)}</span>
        <LaboToothSurfaces tooth={tooth} />
        <span className="pd-labo-tooth-passed">
          <b>{passedLabel(order, tooth)}</b>
          {inCheck && <small>{t("Labo:Check:NotInDelivery")}</small>}
        </span>
        <LaboReturnCount count={tooth.returnCount} />
        <LaboToothWarranty tooth={tooth} passed />
      </div>
    </li>
  );
}

/** B. Kiểm tra & kết luận từng răng: a row per due tooth, then the ones passed before. */
export function LaboToothCheckList({ order, check }: { order: LaboOrderDto; check: LaboCheckForm }) {
  const tally = teethTally(
    check.teeth.map((tooth) => tooth.toothNumber),
    check.picks,
  );
  return (
    <section className="pd-labo-check-section">
      <LaboTeethHead status={tally.label} tone={tally.tone}>
        {check.editable && (
          <button type="button" className="pd-labo-pass-all" disabled={check.busy} onClick={check.passAll}>
            {t("Labo:Check:PassAll")}
          </button>
        )}
      </LaboTeethHead>
      <ul className="pd-labo-tooth-list">
        {check.teeth.map((tooth) => (
          <LaboToothCheckRow key={tooth.toothNumber} tooth={tooth} order={order} check={check} />
        ))}
        {passedTeeth(order).map((tooth) => (
          <PassedToothRow key={tooth.toothNumber} order={order} tooth={tooth} inCheck />
        ))}
      </ul>
    </section>
  );
}

/**
 * B. once every tooth has passed (Hoàn thành / Bảo hành): the same greyed rows,
 * read-only, so "đã lắp dd/mm" and the activated card stay in sight (m342).
 */
export function LaboPassedTeethList({ order }: { order: LaboOrderDto }) {
  const teeth = passedTeeth(order);
  if (teeth.length === 0 || teeth.length < order.teeth.length) return null;
  return (
    <section className="pd-labo-check-section">
      <LaboTeethHead status={t("Labo:Check:Tally", teeth.length, 0)} tone="pass" />
      <ul className="pd-labo-tooth-list">
        {teeth.map((tooth) => (
          <PassedToothRow key={tooth.toothNumber} order={order} tooth={tooth} inCheck={false} />
        ))}
      </ul>
    </section>
  );
}
