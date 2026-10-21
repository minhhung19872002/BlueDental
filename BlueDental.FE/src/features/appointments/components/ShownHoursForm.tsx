import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import {
  DEFAULT_BREAK,
  DEFAULT_CALENDAR_WINDOW,
  windowProblem,
  type CalendarWindow,
  type TimeRange,
  type WindowProblem,
} from "../store/calendarWindowStore";
import { BreakRow, ClockField } from "./ShownHoursFields";

const PROBLEM_KEYS: Record<WindowProblem["kind"], string> = {
  order: "Appointment:ShownHours:Invalid",
  breakOrder: "Appointment:ShownHours:BreakInvalid",
  breakOutside: "Appointment:ShownHours:BreakOutside",
  breakOverlap: "Appointment:ShownHours:BreakOverlap",
};

/** Latest a new break may start, so its hour still ends by 23:45. */
const LAST_BREAK_START = 22 * 60 + 45;

/** 12:00–13:00 first; after that an hour long, an hour after the latest break. */
function nextBreak(breaks: TimeRange[]): TimeRange {
  if (breaks.length === 0) return DEFAULT_BREAK;
  const latestEnd = Math.max(...breaks.map((b) => b.toMinute));
  const fromMinute = Math.min(latestEnd + 60, LAST_BREAK_START);
  return { fromMinute, toMinute: fromMinute + 60 };
}

interface Props {
  initial: CalendarWindow;
  onApply: (range: CalendarWindow) => void;
}

/** The window's two pickers and its breaks; nothing reaches the calendars until Áp dụng. */
export function ShownHoursForm({ initial, onApply }: Props) {
  const [draft, setDraft] = useState(initial);
  const problem = windowProblem(draft);
  const badBreak = problem && problem.kind !== "order" ? problem.breakIndex : null;

  const setBreak = (index: number, range: TimeRange) =>
    setDraft((d) => ({ ...d, breaks: d.breaks.map((b, i) => (i === index ? range : b)) }));
  const removeBreak = (index: number) =>
    setDraft((d) => ({ ...d, breaks: d.breaks.filter((_, i) => i !== index) }));
  const addBreak = () => setDraft((d) => ({ ...d, breaks: [...d.breaks, nextBreak(d.breaks)] }));

  return (
    <div className="cal-hours-form">
      <ClockField
        label={t("Appointment:ShownHours:From")}
        minute={draft.fromMinute}
        onChange={(fromMinute) => setDraft((d) => ({ ...d, fromMinute }))}
      />
      <ClockField
        label={t("Appointment:ShownHours:To")}
        minute={draft.toMinute}
        invalid={problem?.kind === "order"}
        onChange={(toMinute) => setDraft((d) => ({ ...d, toMinute }))}
      />
      <div className="cal-hours-breaks" role="group" aria-label={t("Appointment:ShownHours:Breaks")}>
        <span className="cal-hours-breaks-title">{t("Appointment:ShownHours:Breaks")}</span>
        {draft.breaks.map((range, index) => (
          <BreakRow
            key={index}
            position={index + 1}
            range={range}
            invalid={badBreak === index}
            onChange={(next) => setBreak(index, next)}
            onRemove={() => removeBreak(index)}
          />
        ))}
        <Button size="small" type="dashed" block icon={<PlusOutlined />} onClick={addBreak}>
          {t("Appointment:ShownHours:AddBreak")}
        </Button>
      </div>
      <div className={problem ? "cal-hours-hint cal-hours-hint--error" : "cal-hours-hint"} role={problem ? "alert" : undefined}>
        {t(problem ? PROBLEM_KEYS[problem.kind] : "Appointment:ShownHours:Hint")}
      </div>
      <div className="cal-hours-actions">
        <Button size="small" onClick={() => setDraft(DEFAULT_CALENDAR_WINDOW)}>
          {t("Appointment:ShownHours:Default")}
        </Button>
        <Button size="small" type="primary" disabled={problem !== null} onClick={() => onApply(draft)}>
          {t("Appointment:ShownHours:Apply")}
        </Button>
      </div>
    </div>
  );
}
