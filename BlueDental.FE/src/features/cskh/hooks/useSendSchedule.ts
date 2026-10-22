import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";

const nextHour = () => dayjs().add(1, "hour").startOf("hour");

/** "Hẹn giờ gửi": off sends now; switched on, it starts at the next full hour. */
export function useSendSchedule() {
  const [enabled, setEnabled] = useState(false);
  const [at, setAt] = useState<Dayjs>(nextHour);

  const toggle = (on: boolean) => {
    setEnabled(on);
    if (on) setAt(nextHour());
  };

  return {
    enabled,
    at,
    /** The server refuses a time that is not ahead of now (Tools:0021). */
    isPast: enabled && !at.isAfter(dayjs()),
    scheduledAt: enabled ? at.toISOString() : null,
    toggle,
    setDate: (date: Dayjs) => setAt((prev) => prev.year(date.year()).month(date.month()).date(date.date())),
    setTime: (time: Dayjs) => setAt((prev) => prev.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)),
  };
}

export type SendSchedule = ReturnType<typeof useSendSchedule>;
