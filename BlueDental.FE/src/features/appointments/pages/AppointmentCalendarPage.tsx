import { useState } from "react";
import { Button, Tabs, Segmented } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { DayViewCalendar, type DayViewDoctor } from "../components/DayViewCalendar";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";

type ViewMode = "day" | "week" | "month";

const MOCK_DOCTORS: DayViewDoctor[] = [
  { id: "1", name: "BS Khanh",    appointmentCount: 0 },
  { id: "2", name: "BS Tiên",     appointmentCount: 0 },
  { id: "3", name: "BS Hương 4",  appointmentCount: 0 },
  { id: "4", name: "BS Hương",    appointmentCount: 0 },
  { id: "5", name: "BS Tới 10",   appointmentCount: 0 },
  { id: "6", name: "BS Tới 3",    appointmentCount: 0 },
  { id: "7", name: "BS Tới 1",    appointmentCount: 0 },
  { id: "8", name: "BS Tới",      appointmentCount: 0 },
];

export function AppointmentCalendarPage() {
  const [topTab, setTopTab] = useState("customer");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [keyword, setKeyword] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>();

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
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Top-level tabs */}
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #E5E7EB",
            paddingLeft: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Tabs
            activeKey={topTab}
            onChange={setTopTab}
            style={{ marginBottom: 0 }}
            items={[
              { key: "customer", label: "Lịch hẹn khách hàng" },
              { key: "work",     label: "Lịch làm việc" },
            ]}
          />
        </div>

        {/* Toolbar row 1: view mode + date nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            background: "#fff",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: "Ngày",  value: "day" },
              { label: "Tuần",  value: "week" },
              { label: "Tháng", value: "month" },
            ]}
            style={{ fontWeight: 500 }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 120, textAlign: "center", fontWeight: 600, fontSize: 14, color: "#1B2A41" }}>
              {displayDate()}
            </span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
          </div>
        </div>

        {/* Day view calendar with doctor columns */}
        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          {topTab === "customer" ? (
            <DayViewCalendar
              currentDate={currentDate}
              doctors={MOCK_DOCTORS}
              onDateChange={navigateDate}
              onCellClick={handleCellClick}
              keyword={keyword}
              onKeywordChange={setKeyword}
            />
          ) : (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <div style={{ fontWeight: 500, color: "#6B7280" }}>Lịch làm việc</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nội dung đang được phát triển</div>
            </div>
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
