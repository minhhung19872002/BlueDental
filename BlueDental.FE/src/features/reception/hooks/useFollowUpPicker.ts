import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  atMinute,
  bookedOn,
  firstFreeRange,
  fitsIn,
  freeStretches,
  mondayOf,
  openWindows,
  quickPickDate,
  sessionTracks,
  type QuickPickKey,
} from "../utils/followUpSlots";
import { useDoctorWeek } from "./useDoctorWeek";
import {
  REBOOK_NOTE_MAX,
  type BookFollowUpInput,
  type MinuteSpan,
  type RebookUndatedInput,
} from "../types/reception";

/** "auto" follows the first free half hour of the day, even after the bookings arrive. */
type RangeChoice = { kind: "auto" } | { kind: "manual"; range: MinuteSpan } | null;

const DAY_FORMAT = "YYYY-MM-DD";

/**
 * The state behind "Chọn lịch hẹn tiếp theo": the doctor, which week is on
 * screen, the day and time range picked, and the quick pick that got there
 * (only one at a time; picking a day by hand clears it). A range goes only
 * where the doctor works and has nothing booked (owner 2026-10-28) — the
 * overlap warning on save is left for a visit booked in the meantime.
 */
export function useFollowUpPicker(defaultDoctorId: string | undefined) {
  const [today] = useState(() => dayjs().startOf("day"));
  const [doctorId, setDoctorId] = useState<string | undefined>(defaultDoctorId || undefined);
  const [weekStart, setWeekStart] = useState<Dayjs>(() => mondayOf(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [choice, setChoice] = useState<RangeChoice>(null);
  const [quickPick, setQuickPick] = useState<QuickPickKey | null>(null);
  const [notes, setNotes] = useState("");
  const now = Date.now();

  const day = selectedDay ? dayjs(selectedDay) : null;
  const shownWeek = useDoctorWeek(doctorId, weekStart);
  // The picked day's own week: the strip may have moved on since.
  const pickedWeek = useDoctorWeek(doctorId, day ? mondayOf(day) : weekStart);

  const workDay = day ? pickedWeek.workDayOf(day) : undefined;
  const open = day && workDay ? openWindows(day, workDay, now) : [];
  const booked = day ? bookedOn(day, pickedWeek.busy) : [];
  const free = freeStretches(open, booked);
  const tracks = workDay ? sessionTracks(workDay, open, booked, free) : null;

  const selectedRange = (() => {
    if (!choice) return undefined;
    if (choice.kind === "auto") return firstFreeRange(free);
    return fitsIn(free, choice.range) ? choice.range : undefined;
  })();

  const handleQuickPick = (key: QuickPickKey) => {
    const date = quickPickDate(today, key);
    setQuickPick(key);
    setWeekStart(mondayOf(date));
    setSelectedDay(date.format(DAY_FORMAT));
    setChoice({ kind: "auto" });
  };

  const handleDaySelect = (date: Dayjs) => {
    setQuickPick(null);
    setSelectedDay(date.format(DAY_FORMAT));
    setChoice(null);
  };

  const canFit = (range: MinuteSpan) => fitsIn(free, range);
  /** The timeline, the Từ / Đến steppers and the length chips: a range that does not fit is ignored. */
  const handleRangeChange = (range: MinuteSpan) => {
    if (canFit(range)) setChoice({ kind: "manual", range });
  };

  const canGoBack = weekStart.isAfter(mondayOf(today));
  const handlePrevWeek = () => canGoBack && setWeekStart((w) => w.subtract(1, "week"));
  const handleNextWeek = () => setWeekStart((w) => w.add(1, "week"));

  const buildInput = (): BookFollowUpInput | null => {
    if (!day || !selectedRange) return null;
    return {
      slotStart: atMinute(day, selectedRange.start).toISOString(),
      slotEnd: atMinute(day, selectedRange.end).toISOString(),
      dentistId: doctorId,
      chiefComplaint: notes.trim() || undefined,
    };
  };

  /** "Hẹn lại - Chưa chốt ngày" skips the day and time; the doctor and note still go along. */
  const buildUndatedInput = (): RebookUndatedInput => ({
    dentistId: doctorId,
    note: notes.trim() || undefined,
  });

  return {
    today,
    now,
    doctorId,
    weekStart,
    selectedDay: day,
    selectedRange,
    quickPick,
    notes,
    shownWeek,
    tracks,
    canGoBack,
    canConfirm: !!selectedRange && !pickedWeek.loading,
    undatedNoteTooLong: notes.trim().length > REBOOK_NOTE_MAX,
    canFit,
    setDoctorId,
    setNotes,
    handleQuickPick,
    handleDaySelect,
    handleRangeChange,
    handlePrevWeek,
    handleNextWeek,
    buildInput,
    buildUndatedInput,
  };
}

export type FollowUpPicker = ReturnType<typeof useFollowUpPicker>;
