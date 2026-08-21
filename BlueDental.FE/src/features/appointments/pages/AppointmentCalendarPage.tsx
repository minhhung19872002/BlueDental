import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { AppointmentCalendar } from "../components/AppointmentCalendar";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { useAppointmentList } from "../api/appointmentQueries";
import { adaptAppointment } from "../api/appointmentAdapters";

dayjs.extend(isoWeek);

export function AppointmentCalendarPage() {
  const [weekStart, setWeekStart] = useState(() =>
    dayjs().startOf("isoWeek"),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>();
  const [initialTime, setInitialTime] = useState<string | undefined>();

  const { data } = useAppointmentList({
    date: weekStart.format("YYYY-MM-DD"),
    maxResultCount: 200,
  });

  const appointments = (data?.items ?? []).map(adaptAppointment);

  const handleSlotClick = (date: string, slotStart: string) => {
    setInitialDate(date);
    setInitialTime(slotStart);
    setAddOpen(true);
  };

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-header-title">Lịch hẹn</h1>
            <p className="page-header-subtitle">
              Xem và quản lý lịch hẹn khám của phòng khám
            </p>
          </div>
          <div className="page-header-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setInitialDate(undefined);
                setInitialTime(undefined);
                setAddOpen(true);
              }}
            >
              Đặt lịch hẹn
            </Button>
          </div>
        </div>

        <AppointmentCalendar
          weekStart={weekStart}
          appointments={appointments}
          onWeekChange={(dir) => setWeekStart((w) => w.add(dir * 7, "day"))}
          onSlotClick={handleSlotClick}
          onAppointmentClick={(appt) => setSelectedId(appt.id)}
        />
      </div>

      <AppointmentEditorModal
        open={addOpen}
        initialDate={initialDate}
        initialTime={initialTime}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />

      <AppointmentDetailDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
