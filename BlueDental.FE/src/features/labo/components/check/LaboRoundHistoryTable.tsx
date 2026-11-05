import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { LABO_TOOTH_RESULT, type LaboOrderDto, type LaboToothResult } from "@/features/labo/api/laboApi";
import { historyAside, toothHistoryRows, type LaboLiveCheck, type LaboToothHistoryRow } from "./laboCheckHistory";
import type { LaboTone } from "./laboCheckRules";
import { faultLine } from "./laboToothFaces";

const RESULT_PILL: Partial<Record<LaboToothResult, { label: string; tone: LaboTone }>> = {
  [LABO_TOOTH_RESULT.Passed]: { label: "Labo:Check:Pass", tone: "pass" },
  [LABO_TOOTH_RESULT.Failed]: { label: "Labo:Check:Fail", tone: "fail" },
};

const toned = (tone: LaboTone) => `pd-labo-tone pd-labo-tone--${tone}`;

/** The rows of one delivery, newest delivery first, as the Labo 2 mock stacks them. */
function byRound(rows: LaboToothHistoryRow[]): LaboToothHistoryRow[][] {
  const rounds = new Map<number, LaboToothHistoryRow[]>();
  for (const row of rows) rounds.set(row.roundNo, [...(rounds.get(row.roundNo) ?? []), row]);
  return [...rounds.values()].reverse();
}

function ToothLine({ row }: { row: LaboToothHistoryRow }) {
  const pill = RESULT_PILL[row.result];
  const dueOn = formatDate(row.redeliveryDueAt);
  const due = dueOn && t("Labo:Check:History:Due", dueOn);
  const faults = faultLine(row.tooth, row.faults);
  // "Sai màu (mặt Gần, Xa) · hẹn 12/11/2026" as the Labo 2 v2 mock reads it (R-1151).
  const defect = [row.note, faults && t("Labo:Check:History:Faults", faults)].filter(Boolean).join(" ");
  return (
    <tr>
      <td>
        <div className="pd-labo-history-line">
          <b>{t("Labo:Check:History:ToothNo", row.tooth)}</b>
          {pill ? <span className={`pd-labo-result-pill ${toned(pill.tone)}`}>{t(pill.label)}</span> : "—"}
          <span className={`pd-labo-history-action ${toned(row.action.tone)}`}>{row.action.label}</span>
        </div>
        {(defect || due) && (
          <div className="pd-labo-history-defect">{[defect, due].filter(Boolean).join(" · ")}</div>
        )}
      </td>
    </tr>
  );
}

interface Props {
  order: LaboOrderDto;
  /** The check on screen, shown as the open round's "đang nhập" rows. */
  live: LaboLiveCheck | null;
}

/**
 * Lịch sử nhận hàng & trả hàng (P3110 m189, m294) in the left column of the
 * Labo 2 mock: one card per delivery — Lần · ngày over its tally — and a line
 * per tooth with its result, what was done and, for a Lỗi, the defect and
 * Hẹn giao lại.
 */
export function LaboRoundHistoryTable({ order, live }: Props) {
  const rounds = byRound(toothHistoryRows(order, live));
  return (
    <section className="pd-labo-check-section pd-labo-history">
      <header className="pd-labo-check-head">
        <h3>{t("Labo:Check:History:Title")}</h3>
        <span className="pd-labo-check-aside">{historyAside(order, live)}</span>
      </header>
      {rounds.length === 0 && <p className="pd-labo-history-empty">{t("Labo:Check:History:Empty")}</p>}
      {rounds.map((rows) => {
        const head = rows[0];
        return (
          <article
            key={head.roundNo}
            className={["pd-labo-history-round", head.live && "pd-labo-history-live"].filter(Boolean).join(" ")}
          >
            <header className={`pd-labo-history-round-head pd-labo-history-round-head--${head.roundTally.tone}`}>
              <b>{t("Labo:Check:History:RoundOn", head.roundNo, dayjs(head.receivedAt).format("DD/MM"))}</b>
              <span className={`pd-labo-history-sub ${toned(head.roundTally.tone)}`}>{head.roundTally.label}</span>
            </header>
            <table>
              <tbody>
                {rows.map((row) => (
                  <ToothLine key={row.key} row={row} />
                ))}
              </tbody>
            </table>
          </article>
        );
      })}
    </section>
  );
}
