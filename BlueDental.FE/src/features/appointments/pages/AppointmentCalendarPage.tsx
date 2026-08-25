import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Segmented } from "antd";
import { PillTabs } from "@/components/PillTabs";
import dayjs, { type Dayjs } from "dayjs";
import { LeftOutlined, RightOutlined, DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/PageHeader";
import { DayViewCalendar, type DayViewDoctor } from "../components/DayViewCalendar";
import { WeekViewCalendar } from "../components/WeekViewCalendar";
import { MonthViewCalendar } from "../components/MonthViewCalendar";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useAppointmentList } from "../api/appointmentQueries";
import { exportToExcel } from "@/utils/exportExcel";
import { TimekeepingBoard } from "@/features/timekeeping/components/TimekeepingBoard";
import { t } from "@/lib/i18n";

type ViewMode = "day" | "week" | "month";

// Placeholder names, shown only while the staff API is unreachable. People's
// names are not UI text, so they stay out of the translation overlay.
const FALLBACK_DOCTORS: DayViewDoctor[] = [
  { id: "1", name: "BS Khanh",   appointmentCount: 0 },
  { id: "2", name: "BS Tiên",    appointmentCount: 0 },
  { id: "3", name: "BS Hương 4", appointmentCount: 0 },
  { id: "4", name: "BS Hương",   appointmentCount: 0 },
  { id: "5", name: "BS Tới 10",  appointmentCount: 0 },
  { id: "6", name: "BS Tới 3",   appointmentCount: 0 },
  { id: "7", name: "BS Tới 1",   appointmentCount: 0 },
  { id: "8", name: "BS Tới",     appointmentCount: 0 },
];

export function AppointmentCalendarPage() {
  const { data: dentistData } = useDentistList();
  const doctors: DayViewDoctor[] = dentistData
    ? dentistData.map((d) => ({ id: d.id, name: d.name }))
    : FALLBACK_DOCTORS;
  // The reference keeps this tab in the URL (/calendar?tab=timekeeping), so a
  // link to the work schedule board is shareable and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const topTab = searchParams.get("tab") === "timekeeping" ? "work" : "customer";
  const setTopTab = (key: string) => {
    setSearchParams((params) => {
      if (key === "work") {
        params.set("tab", "timekeeping");
      } else {
        params.delete("tab");
      }
      return params;
    });
  };
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  // The date lives in the URL too, so a day (or a work-schedule board) can be
  // linked to and survives a reload.
  const currentDate = dayjs(searchParams.get("date") ?? undefined);
  const setCurrentDate = (updater: (d: Dayjs) => Dayjs) => {
    setSearchParams((params) => {
      params.set("date", updater(dayjs(params.get("date") ?? undefined)).format("YYYY-MM-DD"));
      return params;
    });
  };
  const [keyword, setKeyword] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>();

  // The design's "Xuất file" writes the day being viewed.
  const { data: dayAppointments } = useAppointmentList({
    date: currentDate.format("YYYY-MM-DD"),
    maxResultCount: 500,
  });

  const handleExport = () => {
    exportToExcel(
      dayAppointments?.items ?? [],
      [
        { header: t("Bệnh nhân"), key: "patientName" },
        { header: t("Bác sĩ"), key: "doctorName" },
        {
          header: t("Bắt đầu"),
          key: "startTime",
          format: (v) => (v ? dayjs(String(v)).format("DD/MM/YYYY HH:mm") : ""),
        },
        {
          header: t("Kết thúc"),
          key: "endTime",
          format: (v) => (v ? dayjs(String(v)).format("HH:mm") : ""),
        },
        { header: t("Trạng thái"), key: "status" },
        { header: t("Lý do"), key: "reason" },
      ],
      `lich-hen-${currentDate.format("YYYY-MM-DD")}`,
    );
  };

  const navigateDate = (dir: -1 | 1) => {
    const unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month";
    setCurrentDate((d) => d.add(dir, unit));
  };

  const displayDate = () => {
    if (viewMode === "day") return currentDate.format("DD/MM/YYYY");
    if (viewMode === "week") {
      const start = currentDate.startOf("week").format("DD/MM");
      const end = currentDate.endOf("week").format("DD/MM/YYYY");
      return `${start} – ${end}`;
    }
    return currentDate.format("MM/YYYY");
  };

  const handleCellClick = (doctorId: string, slotIndex: number) => {
    setInitialDate(currentDate.format("YYYY-MM-DD"));
    setAddOpen(true);
    void doctorId;
    void slotIndex;
  };

  return (
    <>
      <div className="reception-page">
        <PageHeader
          title={t("Lịch hẹn khách hàng")}
          subtitle={t(
            "Kéo thẻ hẹn sang ô khác để đổi bác sĩ hoặc giờ · bấm ô trống để tạo mới",
          )}
          actions={
            <>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                {t("Xuất file")}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                {t("Tạo lịch hẹn mới")}
              </Button>
            </>
          }
        />

        {/* Top-level switcher — the design uses pills here, not a tab row. */}
        <div className="reception-card reception-card--tabs">
          <PillTabs
            activeKey={topTab}
            onChange={setTopTab}
            items={[
              { key: "customer", label: t("Lịch hẹn khách hàng") },
              { key: "work",     label: t("Lịch làm việc") },
            ]}
          />
        </div>

        {/* Toolbar: view mode + date nav */}
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: t("Ngày"),  value: "day" },
              { label: t("Tuần"),  value: "week" },
              { label: t("Tháng"), value: "month" },
            ]}
            style={{ fontWeight: 500 }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 120, textAlign: "center", fontWeight: 600, fontSize: 14, color: "#101c2c" }}>
              {displayDate()}
            </span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
            </div>
          </div>
        </div>

        {/* Calendar grid — switches by viewMode */}
        <div className="reception-card calendar-grid-card">
          {topTab === "customer" ? (
            <>
              {viewMode === "day" && (
                <DayViewCalendar
                  currentDate={currentDate}
                  doctors={doctors}
                  onDateChange={navigateDate}
                  onCellClick={handleCellClick}
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                  onSelectAppointment={setSelectedId}
                />
              )}
              {viewMode === "week" && (
                <WeekViewCalendar
                  currentDate={currentDate}
                  doctors={doctors}
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                  onCreateAppointment={() => setAddOpen(true)}
                  onSelectAppointment={setSelectedId}
                  onCellClick={(dayIdx, slotIdx) => {
                    setInitialDate(currentDate.startOf("week").add(dayIdx, "day").format("YYYY-MM-DD"));
                    setAddOpen(true);
                    void slotIdx;
                  }}
                />
              )}
              {viewMode === "month" && (
                <MonthViewCalendar
                  currentDate={currentDate}
                  onDayClick={(day) => {
                    setCurrentDate(() => day);
                    setViewMode("day");
                  }}
                />
              )}
            </>
          ) : (
            <TimekeepingBoard currentDate={currentDate} />
          )}
        </div>
      </div>

      <AppointmentEditorModal
        open={addOpen}
        initialDate={initialDate}
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
