import { useMemo, useRef } from "react";
import { Button, Input, Select } from "antd";
import { SearchOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";

const SLOT_MINUTES = 30;
const DAY_START_H = 6;
const DAY_END_H = 24;
const TOTAL_SLOTS = ((DAY_END_H - DAY_START_H) * 60) / SLOT_MINUTES;
const SLOT_H = 36;
const HEADER_H = 44;
const TIME_COL_W = 64;
const DOCTOR_COL_W = 140;

function slotTime(slotIndex: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

const APPT_COLORS: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  scheduled:  { bg: "#EBF3FE", border: "#1E70E6", text: "#1E70E6" },
  confirmed:  { bg: "#E0F2FE", border: "#2671D8", text: "#2671D8" },
  inProgress: { bg: "#FFEDD5", border: "#F97316", text: "#F97316" },
  completed:  { bg: "#E6F4EA", border: "#10B981", text: "#10B981" },
  cancelled:  { bg: "#FCE8E6", border: "#EF4444", text: "#EF4444" },
  noShow:     { bg: "#F3F4F6", border: "#9CA3AF", text: "#9CA3AF" },
};


export interface DayViewDoctor {
  id: string;
  name: string;
  appointmentCount?: number;
}

interface Props {
  currentDate: Dayjs;
  doctors?: DayViewDoctor[];
  appointments?: AppointmentDto[];
  onDateChange?: (dir: -1 | 1) => void;
  onCellClick?: (doctorId: string, slotIndex: number) => void;
  onAppointmentClick?: (appointment: AppointmentDto) => void;
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  onCreateAppointment?: () => void;
}

export function DayViewCalendar({
  currentDate,
  doctors = [],
  appointments = [],
  onDateChange,
  onCellClick,
  onAppointmentClick,
  keyword = "",
  onKeywordChange,
  onCreateAppointment,
}: Props) {
  const { t } = useTranslation();
  const STATUS_FILTER_BUTTONS = [
    { key: "scheduled",  label: t("appointment.statusScheduled"),    borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
    { key: "arrived",    label: t("reception.counters.arrived"),      borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
    { key: "cancelled",  label: t("reception.counters.cancelled"),    borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
    { key: "late",       label: t("reception.counters.late"),         borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
    { key: "temporary",  label: t("reception.counters.temporary"),    borderColor: "#F97316", bgColor: "#FFEDD5", textColor: "#F97316" },
    { key: "converted",  label: t("reception.counters.converted"),    borderColor: "#06B6D4", bgColor: "#CFFAFE", textColor: "#06B6D4" },
  ];
  const scrollRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);
  const isHourStart = (slotIdx: number) => slotIdx % 2 === 0;
  const displayDate = currentDate.format("DD/MM/YYYY");

  // Count by status for counter buttons
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { scheduled: 0, arrived: 0, cancelled: 0, late: 0, temporary: 0, converted: 0 };
    for (const a of appointments) {
      if (a.status === "scheduled" || a.status === "confirmed") counts.scheduled++;
      else if (a.status === "inProgress") counts.arrived++;
      else if (a.status === "cancelled") counts.cancelled++;
      else if (a.status === "noShow") counts.late++;
    }
    return counts;
  }, [appointments]);

  // Map doctorId → appointment list for O(1) lookup
  const appointmentsByDoctor = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appt of appointments) {
      if (!map.has(appt.doctorId)) map.set(appt.doctorId, []);
      map.get(appt.doctorId)!.push(appt);
    }
    return map;
  }, [appointments]);

  const totalSlotH = TOTAL_SLOTS * SLOT_H;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Status counter filter buttons */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
        {STATUS_FILTER_BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              border: `1px solid ${btn.borderColor}`,
              backgroundColor: btn.bgColor, color: btn.textColor,
              fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%",
              backgroundColor: btn.borderColor, color: "#fff", fontSize: 11, fontWeight: 700,
            }}>
              {statusCounts[btn.key] ?? 0}
            </span>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Toolbar row 2 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#fff", borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
          placeholder={t("common.search")}
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          allowClear
          style={{ maxWidth: 200 }}
        />
        <Select
          placeholder={t("appointment.selectDoctor")}
          allowClear
          style={{ minWidth: 160 }}
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="small">{t("common.exportExcel")}</Button>
          <Button type="primary" size="small" style={{ background: "#2671D8" }} onClick={onCreateAppointment}>
            {t("appointment.createAppointment")}
          </Button>
          <Button size="small">{t("appointment.createAppointmentTemp")}</Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ overflowX: "auto" }} ref={scrollRef}>
        <div style={{ position: "relative", minWidth: TIME_COL_W + Math.max(doctors.length, 1) * DOCTOR_COL_W }}>
          {/* Structural grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${TIME_COL_W}px repeat(${Math.max(doctors.length, 1)}, ${DOCTOR_COL_W}px)`,
            }}
          >
            {/* Header row */}
            <div style={{ height: HEADER_H, position: "sticky", top: 0, zIndex: 10, background: "#F8FAFC", borderBottom: "2px solid #E5E7EB", borderRight: "1px solid #E5E7EB", padding: "8px 4px", fontSize: 11, color: "#9CA3AF", textAlign: "center", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t("appointment.headerTimeDoctor").split(" / ")[0]} /<br />{t("appointment.headerTimeDoctor").split(" / ")[1]}
            </div>
            {doctors.length === 0 ? (
              <div style={{ height: HEADER_H, background: "#F8FAFC", borderBottom: "2px solid #E5E7EB", padding: "8px", color: "#9CA3AF", fontSize: 12, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t("appointment.noDoctor")}
              </div>
            ) : (
              doctors.map((doc) => {
                const docApptCount = appointmentsByDoctor.get(doc.id)?.length ?? doc.appointmentCount ?? 0;
                return (
                  <div key={doc.id} style={{ height: HEADER_H, position: "sticky", top: 0, zIndex: 10, background: "#F8FAFC", borderBottom: "2px solid #E5E7EB", borderLeft: "1px solid #E5E7EB", padding: "8px 4px", fontSize: 13, fontWeight: 600, color: "#1B2A41", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.name}
                      <span style={{ color: "#6B7280", fontWeight: 400, marginLeft: 4 }}>({docApptCount})</span>
                    </span>
                  </div>
                );
              })
            )}

            {/* Time slots */}
            {slots.map((slotIdx) => (
              <>
                <div
                  key={`time-${slotIdx}`}
                  style={{
                    borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                    borderRight: "1px solid #E5E7EB",
                    height: SLOT_H,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11,
                    color: isHourStart(slotIdx) ? "#374151" : "#D1D5DB",
                    fontWeight: isHourStart(slotIdx) ? 500 : 400,
                    background: "#FAFAFA",
                  }}
                >
                  {isHourStart(slotIdx) ? slotTime(slotIdx) : ""}
                </div>
                {doctors.length === 0 ? (
                  <div
                    key={`empty-${slotIdx}`}
                    style={{
                      borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                      borderLeft: "1px solid #E5E7EB",
                      height: SLOT_H,
                      background: slotIdx % 2 === 0 ? "#FAFAFA" : "#fff",
                    }}
                  />
                ) : (
                  doctors.map((doc) => (
                    <div
                      key={`cell-${slotIdx}-${doc.id}`}
                      onClick={() => onCellClick?.(doc.id, slotIdx)}
                      style={{
                        borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                        borderLeft: "1px solid #E5E7EB",
                        height: SLOT_H,
                        background: slotIdx % 4 < 2 ? "#FAFAFA" : "#fff",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EBF3FE"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = slotIdx % 4 < 2 ? "#FAFAFA" : "#fff"; }}
                    />
                  ))
                )}
              </>
            ))}
          </div>

          {/* Appointment overlay — absolutely positioned chips on top of the grid */}
          {doctors.length > 0 && appointments.map((appt) => {
            const doctorIdx = doctors.findIndex((d) => d.id === appt.doctorId);
            if (doctorIdx < 0) return null;

            const startDjs = dayjs(appt.startTime);
            const startMinutes = (startDjs.hour() - DAY_START_H) * 60 + startDjs.minute();
            if (startMinutes < 0) return null;

            const durationMins = Math.max(30, dayjs(appt.endTime).diff(startDjs, "minute"));
            const top = HEADER_H + (startMinutes / 30) * SLOT_H + 1;
            const height = Math.max(SLOT_H - 4, (durationMins / 30) * SLOT_H - 4);
            const left = TIME_COL_W + doctorIdx * DOCTOR_COL_W + 2;
            const colors = APPT_COLORS[appt.status] ?? APPT_COLORS.scheduled;

            if (top > HEADER_H + totalSlotH) return null;

            return (
              <div
                key={appt.id}
                onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(appt); }}
                style={{
                  position: "absolute",
                  top,
                  left,
                  width: DOCTOR_COL_W - 4,
                  height,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderLeft: `3px solid ${colors.border}`,
                  borderRadius: 4,
                  padding: "2px 5px",
                  overflow: "hidden",
                  zIndex: 6,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
                title={`${appt.patientName} — ${startDjs.format("HH:mm")}`}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: colors.text, lineHeight: 1.4, whiteSpace: "nowrap" }}>
                  {startDjs.format("HH:mm")} {appt.patientName}
                </div>
                {height >= SLOT_H * 2 && (
                  <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {appt.doctorName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date nav footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "8px", background: "#fff", borderTop: "1px solid #E5E7EB" }}>
        <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => onDateChange?.(-1)}>{t("appointment.prevDay")}</Button>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#1B2A41" }}>{displayDate}</span>
        <Button type="text" size="small" onClick={() => onDateChange?.(1)}>{t("appointment.nextDay")} <RightOutlined /></Button>
      </div>
    </div>
  );
}
