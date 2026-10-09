import type {
  AppointmentSeriesView,
  RecurrenceRequest,
  RecurrenceUnit,
  RecurrenceValues,
  SeriesConflictReason,
  SeriesSession,
  SeriesSessionState,
} from "../types/appointmentSeries";

/** The server's RecurrenceFrequency / RecurrenceEnd / SeriesOccurrenceState / SeriesConflictReason codes. */
const FREQUENCY_BY_UNIT: Record<RecurrenceUnit, number> = { day: 1, week: 2, month: 3 };
/** The three presets repeat every single day / week / month. */
const PRESET_UNIT: Record<Exclude<RecurrenceValues["preset"], "custom">, RecurrenceUnit> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

const END_AFTER_COUNT = 1;
const END_ON_DATE = 2;

const STATE_BY_CODE: Record<number, SeriesSessionState> = {
  1: "free",
  2: "conflict",
  3: "booked",
  4: "timeChanged",
  5: "rescheduled",
  6: "cancelled",
  7: "finished",
};

const REASON_BY_CODE: Record<number, SeriesConflictReason> = {
  1: "dentistBusy",
  2: "patientBusy",
  3: "outsideShift",
  4: "dentistOff",
  5: "inThePast",
};

export interface ServerSeriesSessionDto {
  index: number;
  start: string;
  end: string;
  state: number;
  conflictReason: number | null;
  appointmentId: string | null;
  movedTo?: string | null;
}

export interface ServerSeriesDto {
  id: string | null;
  sessions: ServerSeriesSessionDto[];
}

/**
 * The repeat controls as the server's rule. The three presets repeat every
 * single day / week / month; only Tuỳ chỉnh carries its own "Mỗi N" and days.
 */
export function toRecurrenceRequest(values: RecurrenceValues): RecurrenceRequest {
  const preset = values.preset;
  const unit: RecurrenceUnit = preset === "custom" ? values.unit : PRESET_UNIT[preset];
  const custom = preset === "custom";
  const byCount = values.endKind === "count";
  return {
    frequency: FREQUENCY_BY_UNIT[unit],
    interval: custom ? values.interval : 1,
    weekDays: custom && unit === "week" ? values.weekDays : [],
    end: byCount ? END_AFTER_COUNT : END_ON_DATE,
    count: byCount ? values.count : null,
    until: byCount ? null : values.until || null,
  };
}

function adaptSession(dto: ServerSeriesSessionDto): SeriesSession {
  return {
    index: dto.index,
    start: dto.start,
    end: dto.end,
    state: STATE_BY_CODE[dto.state] ?? "free",
    conflictReason: dto.conflictReason ? REASON_BY_CODE[dto.conflictReason] ?? null : null,
    appointmentId: dto.appointmentId,
    movedTo: dto.movedTo ?? null,
  };
}

export function adaptSeries(dto: ServerSeriesDto): AppointmentSeriesView {
  return { id: dto.id, sessions: dto.sessions.map(adaptSession) };
}
