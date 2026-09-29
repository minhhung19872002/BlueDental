import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useDentistBusySpans } from "../api/receptionQueries";
import {
  SLOT_MINUTES,
  firstFreeTime,
  mondayOf,
  quickPickDate,
  slotAt,
  slotState,
  type QuickPickKey,
} from "../utils/followUpSlots";
import type { BookFollowUpInput } from "../types/reception";

/** "auto" follows the first free slot of the day, even after the busy list arrives. */
type TimeChoice = { kind: "auto" } | { kind: "manual"; time: string } | null;

const DAY_FORMAT = "YYYY-MM-DD";

/**
 * The state behind "Chọn lịch hẹn tiếp theo": which week is on screen, the
 * day and time picked, the optional doctor whose busy slots are greyed out,
 * and the quick pick that got there (only one at a time; picking a day by
 * hand clears it).
 */
export function useFollowUpPicker(defaultDoctorId: string | undefined) {
  const [today] = useState(() => dayjs().startOf("day"));
  const [doctorId, setDoctorId] = useState<string | undefined>(defaultDoctorId || undefined);
  const [weekStart, setWeekStart] = useState<Dayjs>(() => mondayOf(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [timeChoice, setTimeChoice] = useState<TimeChoice>(null);
  const [quickPick, setQuickPick] = useState<QuickPickKey | null>(null);
  const [notes, setNotes] = useState("");

  const weekEnd = weekStart.add(6, "day");
  const busyQuery = useDentistBusySpans(doctorId, weekStart.format(DAY_FORMAT), weekEnd.format(DAY_FORMAT));
  const busy = doctorId ? (busyQuery.data ?? []) : [];
  const now = Date.now();

  const day = selectedDay ? dayjs(selectedDay) : null;
  const selectedTime = (() => {
    if (!day || !timeChoice) return undefined;
    if (timeChoice.kind === "auto") return firstFreeTime(day, busy, now);
    return slotState(day, timeChoice.time, busy, now) === "free" ? timeChoice.time : undefined;
  })();

  const handleQuickPick = (key: QuickPickKey) => {
    const date = quickPickDate(today, key);
    setQuickPick(key);
    setWeekStart(mondayOf(date));
    setSelectedDay(date.format(DAY_FORMAT));
    setTimeChoice({ kind: "auto" });
  };

  const handleDaySelect = (date: Dayjs) => {
    setQuickPick(null);
    setSelectedDay(date.format(DAY_FORMAT));
    setTimeChoice(null);
  };

  const handleTimeSelect = (time: string) => setTimeChoice({ kind: "manual", time });

  const canGoBack = weekStart.isAfter(mondayOf(today));
  const handlePrevWeek = () => canGoBack && setWeekStart((w) => w.subtract(1, "week"));
  const handleNextWeek = () => setWeekStart((w) => w.add(1, "week"));

  const buildInput = (): BookFollowUpInput | null => {
    if (!day || !selectedTime) return null;
    const start = slotAt(day, selectedTime);
    return {
      slotStart: start.toISOString(),
      slotEnd: start.add(SLOT_MINUTES, "minute").toISOString(),
      dentistId: doctorId,
      chiefComplaint: notes.trim() || undefined,
    };
  };

  return {
    today,
    now,
    doctorId,
    weekStart,
    selectedDay: day,
    selectedTime,
    quickPick,
    notes,
    busy,
    busyLoading: !!doctorId && busyQuery.isFetching,
    canGoBack,
    canConfirm: !!selectedTime && !(doctorId && busyQuery.isFetching),
    setDoctorId,
    setNotes,
    handleQuickPick,
    handleDaySelect,
    handleTimeSelect,
    handlePrevWeek,
    handleNextWeek,
    buildInput,
  };
}

export type FollowUpPicker = ReturnType<typeof useFollowUpPicker>;
