import { useCallback, useMemo } from "react";
import { DatePicker, TimePicker, type DatePickerProps, type TimePickerProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";

const DAY_FORMAT = "YYYY-MM-DD";
const CLOCK_FORMAT = "HH:mm";

type StringPickerProps<TPickerProps> = Omit<TPickerProps, "value" | "defaultValue" | "onChange"> & {
  /** `YYYY-MM-DD` for a day, `HH:mm` for a clock time, "" when empty. */
  value: string;
  onChange: (value: string) => void;
};

/**
 * AntD pickers driven by a string, for forms that store dates as text.
 *
 * A `dayjs(value)` built inline in render is a new object every time, and the
 * picker re-syncs its calendar from `value` whenever that object changes,
 * discarding whatever the user has typed but not yet confirmed with Enter.
 * Memoising on the string keeps the typed text alive across re-renders.
 */
export function DayPicker({ value, onChange, ...rest }: StringPickerProps<DatePickerProps>) {
  const day = useMemo(() => (value ? dayjs(value) : null), [value]);
  const handleChange = useCallback(
    (picked: Dayjs | Dayjs[] | null) => {
      const first = Array.isArray(picked) ? (picked[0] ?? null) : picked;
      onChange(first ? first.format(DAY_FORMAT) : "");
    },
    [onChange],
  );
  return <DatePicker {...rest} value={day} onChange={handleChange} />;
}

export function ClockPicker({ value, onChange, ...rest }: StringPickerProps<TimePickerProps>) {
  const clock = useMemo(() => (value ? dayjs(`2000-01-01 ${value}`) : null), [value]);
  const handleChange = useCallback(
    (picked: Dayjs | null) => onChange(picked ? picked.format(CLOCK_FORMAT) : ""),
    [onChange],
  );
  return <TimePicker {...rest} value={clock} onChange={handleChange} />;
}
