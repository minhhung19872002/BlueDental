import { t } from "@/lib/i18n";
import type { LaboTone } from "./laboCheckRules";

interface Props {
  status: string;
  tone: LaboTone;
}

/** B. Kiểm tra & kết luận từng răng, with where the check stands on the right (P3110 m238, m279). */
export function LaboTeethHead({ status, tone }: Props) {
  return (
    <header className="pd-labo-check-head">
      <span className="pd-labo-check-badge">B</span>
      <h3>{t("Labo:Check:TeethTitle")}</h3>
      <span className="pd-labo-check-hint">{t("Labo:Check:TeethHint")}</span>
      <span className={`pd-labo-check-tally pd-labo-check-tally--${tone}`}>{status}</span>
    </header>
  );
}
