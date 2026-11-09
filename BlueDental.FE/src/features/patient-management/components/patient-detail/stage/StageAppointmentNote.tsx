import { useState } from "react";
import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import {
  pickedOf,
  picksOf,
  QUICK_PICK_UNITS,
  quickPickLabel,
  withPick,
  type QuickPick,
  type QuickPickUnit,
} from "./appointmentNote";
import { REMARK_LIMIT } from "./StageRemarkCell";

const TAB_KEYS: Record<QuickPickUnit, string> = {
  day: "Common:Day",
  week: "Common:Week",
  month: "Common:Month",
};

/** Ngày | Tuần | Tháng — built per render, the captions follow the language. */
const quickTabs = (): SegmentedTabItem<QuickPickUnit>[] =>
  QUICK_PICK_UNITS.map((unit) => ({ key: unit, label: t(TAB_KEYS[unit]) }));

interface Props {
  value: string;
  /** Ngày điều trị, "YYYY-MM-DD" — what the chips count from; empty turns them off. */
  treatmentDate: string;
  onChange: (value: string) => void;
}

/**
 * Ghi chú lịch hẹn — the form's last column (BA, 2026-10-27). It saves as the
 * new công đoạn's Ghi chú, the column of Lịch sử điều trị. The "Chọn nhanh"
 * chips fill in the next visit's date, one at a time, from three tabs — Ngày,
 * Tuần, Tháng (owner, 2026-11-09, R-1175). A form whose note already holds a
 * chip opens on that chip's tab, otherwise on Ngày.
 */
export function StageAppointmentNote({ value, treatmentDate, onChange }: Props) {
  const [tab, setTab] = useState<QuickPickUnit>(() => pickedOf(value, treatmentDate)?.unit ?? "day");
  const picked = pickedOf(value, treatmentDate, tab);

  // The note now holds a chip of another tab only (typed in by hand, or the
  // form reset under us): show that tab. Browsing the tabs is left alone.
  const held = pickedOf(value, treatmentDate);
  const [seen, setSeen] = useState(held);
  if (held !== seen) {
    setSeen(held);
    if (held && picked?.unit !== tab) setTab(held.unit);
  }

  const handlePick = (pick: QuickPick) => {
    const next = withPick(value, treatmentDate, pick === picked ? undefined : pick);
    if (next.length <= REMARK_LIMIT) onChange(next);
  };

  return (
    <>
      <FloatingLabel label={t("Patient:Stage:AppointmentNote")} floated={value.length > 0}>
        <Input.TextArea
          rows={5}
          value={value}
          maxLength={REMARK_LIMIT}
          aria-label={t("Patient:Stage:AppointmentNote")}
          onChange={(event) => onChange(event.target.value)}
        />
      </FloatingLabel>
      <div className="pd-stage-quickpick">
        <div className="pd-stage-quickpick-head">
          <span>{t("Patient:Stage:QuickPick")}</span>
          <SegmentedTabs items={quickTabs()} activeKey={tab} onChange={setTab} className="pd-stage-quicktabs" />
        </div>
        <div className="pd-stage-quickpick-chips" role="group" aria-label={t("Patient:Stage:QuickPick")}>
          {picksOf(tab).map((pick) => {
            const { step, day } = quickPickLabel(treatmentDate, pick);
            return (
              <button
                key={`${pick.count}${pick.unit}`}
                type="button"
                className={pick === picked ? "active" : undefined}
                aria-pressed={pick === picked}
                disabled={!treatmentDate}
                onClick={() => handlePick(pick)}
              >
                <span>{step}</span>
                {day && (
                  <>
                    {" "}
                    <span>{`· ${day}`}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
