import type { TimePickerProps } from "antd";

const OPEN_HOUR = 7;
const CLOSE_HOUR = 19;

const HOURS_OUTSIDE_CLINIC = Array.from({ length: 24 }, (_, hour) => hour).filter(
  (hour) => hour < OPEN_HOUR || hour > CLOSE_HOUR,
);

/**
 * Booking time pickers list only the clinic's hours (07–19) instead of 00–23.
 * The popup class drops AntD's bottom spacer, which is sized for a full column
 * and leaves a mostly empty scroll area once the hours are cut down.
 */
export const CLINIC_HOURS_PICKER_PROPS: Pick<TimePickerProps, "disabledTime" | "hideDisabledOptions" | "classNames"> = {
  disabledTime: () => ({ disabledHours: () => HOURS_OUTSIDE_CLINIC }),
  hideDisabledOptions: true,
  classNames: { popup: "bd-clinic-hours-popup" },
};
