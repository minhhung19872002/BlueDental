import { TimePicker as AntTimePicker, type TimePickerProps } from "antd";

/**
 * App-wide time picker: picking an hour or a minute commits the value right
 * away, with no OK button to press. Use this instead of AntD's `TimePicker`
 * so every time field behaves the same.
 */
export function TimePicker(props: TimePickerProps) {
  return <AntTimePicker needConfirm={false} {...props} />;
}
