import { Checkbox, DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import type { SendSchedule } from "../../hooks/useSendSchedule";

/** "Hẹn giờ gửi": off sends at once; on, the send waits for the day and time picked here. */
export function SendScheduleFields({ schedule }: { schedule: SendSchedule }) {
  return (
    <div className="snd-schedule">
      <Checkbox checked={schedule.enabled} onChange={(event) => schedule.toggle(event.target.checked)}>
        {t("CSKH:Send:Schedule")}
      </Checkbox>
      {schedule.enabled && (
        <div className="snd-schedule-fields">
          <DatePicker
            allowClear={false}
            format={DATE_INPUT_FORMAT}
            aria-label={t("CSKH:Send:ScheduleDate")}
            value={schedule.at}
            disabledDate={(day) => day.isBefore(dayjs(), "day")}
            status={schedule.isPast ? "error" : undefined}
            onChange={(next) => next && schedule.setDate(next)}
          />
          <TimePicker
            allowClear={false}
            format="HH:mm"
            aria-label={t("CSKH:Send:ScheduleTime")}
            value={schedule.at}
            status={schedule.isPast ? "error" : undefined}
            onChange={(next) => next && schedule.setTime(next)}
          />
        </div>
      )}
      {schedule.isPast && <p className="tpe-warn">{t("CSKH:Send:SchedulePast")}</p>}
    </div>
  );
}
