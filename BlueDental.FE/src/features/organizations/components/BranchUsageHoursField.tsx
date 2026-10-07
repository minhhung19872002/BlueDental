import { Form, TimePicker } from "antd";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

export const USAGE_TIME_FORMAT = "HH:mm";

/**
 * Cụm 11 mục 13 — "Giờ được phép sử dụng" on the branch dialog: both times or
 * neither. An end earlier than the start is a window that runs overnight, so
 * it is not an error here; the server refuses only half a window or two equal
 * times.
 */
export function BranchUsageHoursField() {
  return (
    <Form.Item label={t("Organization:UsageHoursLabel")} extra={t("Organization:UsageHoursHint")}>
      <div className="settings-row">
        <Form.Item
          name="usageStartTime"
          noStyle
          dependencies={["usageEndTime"]}
          rules={[bothOrNeither("usageEndTime")]}
        >
          <TimePicker
            format={USAGE_TIME_FORMAT}
            minuteStep={5}
            placeholder={t("Organization:UsageHoursStart")}
            aria-label={t("Organization:UsageHoursStart")}
            className="branch-usage-hours__picker"
          />
        </Form.Item>
        <Form.Item
          name="usageEndTime"
          noStyle
          dependencies={["usageStartTime"]}
          rules={[bothOrNeither("usageStartTime")]}
        >
          <TimePicker
            format={USAGE_TIME_FORMAT}
            minuteStep={5}
            placeholder={t("Organization:UsageHoursEnd")}
            aria-label={t("Organization:UsageHoursEnd")}
            className="branch-usage-hours__picker"
          />
        </Form.Item>
      </div>
    </Form.Item>
  );
}

function bothOrNeither(other: string) {
  return ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
    validator(_: unknown, value: Dayjs | null | undefined) {
      const otherValue = getFieldValue(other);
      return Boolean(value) === Boolean(otherValue)
        ? Promise.resolve()
        : Promise.reject(new Error(t("Organization:UsageHoursIncomplete")));
    },
  });
}
