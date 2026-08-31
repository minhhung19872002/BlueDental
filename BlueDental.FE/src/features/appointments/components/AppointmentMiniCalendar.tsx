import { useState, useMemo } from "react";
import { Segmented, Tooltip } from "antd";
import { MenuOutlined, TableOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator/DateNavigator";
import { useAppointmentList } from "../api/appointmentQueries";
import { t } from "@/lib/i18n";
import { MiniCalDayView } from "./MiniCalDayView";
import { MiniCalWeekView } from "./MiniCalWeekView";
import { MiniCalMonthView } from "./MiniCalMonthView";

export type DaySubMode = "time" | "doctor";

interface Props {
  date: string;
  doctorId?: string;
}

export function AppointmentMiniCalendar({ date, doctorId }: Props) {
  const [mode, setMode] = useState<DateNavigatorMode>("day");
  const [daySubMode, setDaySubMode] = useState<DaySubMode>("time");
  const [viewDate, setViewDate] = useState<Dayjs>(() => (date ? dayjs(date) : dayjs()));

  const queryParams = useMemo(() => {
    const base = { doctorId: doctorId || undefined, maxResultCount: 500 };
    if (mode === "day") {
      return { ...base, date: viewDate.format("YYYY-MM-DD") };
    }
    if (mode === "week") {
      return {
        ...base,
        fromDate: viewDate.startOf("week").format("YYYY-MM-DD"),
        toDate: viewDate.endOf("week").format("YYYY-MM-DD"),
      };
    }
    return {
      ...base,
      fromDate: viewDate.startOf("month").format("YYYY-MM-DD"),
      toDate: viewDate.endOf("month").format("YYYY-MM-DD"),
    };
  }, [viewDate, mode, doctorId]);

  const { data } = useAppointmentList(queryParams);
  const appointments = data?.items ?? [];

  const toggleDaySubMode = () =>
    setDaySubMode((prev) => (prev === "time" ? "doctor" : "time"));

  return (
    <div className="appt-mini-cal">
      <div className="appt-mini-cal-toolbar">
        <div className="appt-mini-cal-left">
          <span className="appt-mini-cal-title">{t("Lịch đã hẹn")}</span>
          {mode === "day" && (
            <Tooltip title={daySubMode === "time" ? t("Xem theo bác sĩ") : t("Xem theo giờ")}>
              <button type="button" className="appt-mini-cal-menu-btn" onClick={toggleDaySubMode}>
                {daySubMode === "time"
                  ? <MenuOutlined style={{ fontSize: 12 }} />
                  : <TableOutlined style={{ fontSize: 12 }} />}
              </button>
            </Tooltip>
          )}
        </div>

        <div className="appt-mini-cal-right">
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as DateNavigatorMode)}
            options={[
              { label: t("Ngày"), value: "day" },
              { label: t("Tuần"), value: "week" },
              { label: t("Tháng"), value: "month" },
            ]}
            size="small"
          />
          <DateNavigator value={viewDate} mode={mode} onChange={setViewDate} />
        </div>
      </div>

      <div className="appt-mini-cal-content">
        {mode === "day" && (
          <MiniCalDayView
            appointments={appointments}
            date={viewDate.format("YYYY-MM-DD")}
            subMode={daySubMode}
          />
        )}
        {mode === "week" && (
          <MiniCalWeekView appointments={appointments} weekStart={viewDate.startOf("week")} />
        )}
        {mode === "month" && (
          <MiniCalMonthView appointments={appointments} monthStart={viewDate.startOf("month")} />
        )}
      </div>
    </div>
  );
}
