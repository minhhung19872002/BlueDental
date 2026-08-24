import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dayjs, { type Dayjs } from "dayjs";
import { DayViewCalendar, type DayViewDoctor } from "../components/DayViewCalendar";
import { WeekViewCalendar } from "../components/WeekViewCalendar";
import { MonthViewCalendar } from "../components/MonthViewCalendar";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { TimekeepingBoard } from "@/features/timekeeping/components/TimekeepingBoard";
import { DateNavigator } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

  const navigateDate = (dir: -1 | 1) => {
    const unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month";
    setCurrentDate((d) => d.add(dir, unit));
  };

  const handleCellClick = (doctorId: string, slotIndex: number) => {
    setInitialDate(currentDate.format("YYYY-MM-DD"));
    setAddOpen(true);
    void doctorId;
    void slotIndex;
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Top-level tabs */}
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #e2e8f0",
            paddingLeft: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Tabs value={topTab} onValueChange={setTopTab}>
            <TabsList className="h-auto bg-transparent p-0 rounded-none border-b-0">
              <TabsTrigger
                value="customer"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
              >
                {t("Lịch hẹn khách hàng")}
              </TabsTrigger>
              <TabsTrigger
                value="work"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
              >
                {t("Lịch làm việc")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Toolbar row 1: view mode + date nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: "#fff",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <SegmentedControl
            options={[
              { key: "day" as ViewMode, label: t("Ngày") },
              { key: "week" as ViewMode, label: t("Tuần") },
              { key: "month" as ViewMode, label: t("Tháng") },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <DateNavigator
            value={currentDate}
            mode={viewMode}
            onChange={(d) => setCurrentDate(() => d)}
          />
        </div>

        {/* Calendar grid — switches by viewMode */}
        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
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
                  onCreateAppointment={() => setAddOpen(true)}
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
