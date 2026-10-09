import { RX_SESSIONS, sessionLabel, type SessionDose } from "@/components/prescription-lines";
import { t } from "@/lib/i18n";

/** "Sáng 1 · Tối 1 · 5 ngày" — the sessions in use, then the days. */
export function doseText(dose: SessionDose): string {
  const sessions = RX_SESSIONS.filter((session) => dose[session] > 0).map(
    (session) => `${sessionLabel(session)} ${dose[session]}`,
  );
  return [...sessions, t("Treatment:RxPrint:DoseDays", dose.days)].join(" · ");
}
