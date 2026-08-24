import { Fragment, useMemo, useRef, useState } from "react";
import { Button, Input, Select } from "antd";
import { SearchOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";

import dayjs from "dayjs";
import { useAppointmentList } from "../api/appointmentQueries";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";
import { t } from "@/lib/i18n";

const SLOT_MINUTES = 30;
const DAY_START_H = 6;
const DAY_END_H = 24;
const TOTAL_SLOTS = ((DAY_END_H - DAY_START_H) * 60) / SLOT_MINUTES;
const SLOT_H = 36;
const TIME_COL_W = 64;
const DOCTOR_COL_W = 140;

function slotTime(slotIndex: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface DayViewDoctor {
  id: string;
  name: string;
  appointmentCount?: number;
}

interface Props {
  currentDate: Dayjs;
  doctors?: DayViewDoctor[];
  onDateChange?: (dir: -1 | 1) => void;
  onCellClick?: (doctorId: string, slotIndex: number) => void;
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  onCreateAppointment?: () => void;
  onSelectAppointment?: (id: string) => void;
}

/**
 * The reference's six status chips, each mapped to the statuses it counts.
 * "Lịch tạm" and "Chuyển đổi" have no server equivalent yet — they stay on the
 * bar at zero rather than being silently attached to the wrong status.
 *
 * UNKNOWN_REFERENCE_BEHAVIOUR: Lịch tạm / Chuyển đổi source.
 */
const statusFilterButtons = (): {
  key: string;
  label: string;
  statuses: AppointmentStatus[];
  borderColor: string;
  bgColor: string;
  textColor: string;
}[] => [
  { key: "scheduled",  label: t("Đã hẹn"),     statuses: ["scheduled", "confirmed"], borderColor: "#1c3566", bgColor: "#eaf0fa", textColor: "#1c3566" },
  { key: "arrived",    label: t("Đã đến"),     statuses: ["inProgress", "completed"], borderColor: "#1f8a63", bgColor: "#e6f5ef", textColor: "#1f8a63" },
  { key: "cancelled",  label: t("Huỷ hẹn"),    statuses: ["cancelled"], borderColor: "#ef4d4d", bgColor: "#FCE8E6", textColor: "#ef4d4d" },
  { key: "late",       label: t("Trễ hẹn"),    statuses: ["noShow"], borderColor: "#dd9426", bgColor: "#FEF3C7", textColor: "#dd9426" },
  { key: "temporary",  label: t("Lịch tạm"),   statuses: [], borderColor: "#dd9426", bgColor: "#FFEDD5", textColor: "#dd9426" },
  { key: "converted",  label: t("Chuyển đổi"), statuses: [], borderColor: "#3d7fa8", bgColor: "#CFFAFE", textColor: "#3d7fa8" },
];

/** Card colours, matching the status pills used elsewhere in the app. */
const CARD_LOOK: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  scheduled:  { bg: "#eaf0fa", border: "#1c3566", text: "#1c3566" },
  confirmed:  { bg: "#e6f5ef", border: "#1f8a63", text: "#166848" },
  inProgress: { bg: "#fdf3e2", border: "#dd9426", text: "#9a6412" },
  completed:  { bg: "#e6f5ef", border: "#25a97a", text: "#166848" },
  cancelled:  { bg: "#fdeeee", border: "#ef4d4d", text: "#c33" },
  noShow:     { bg: "#efedf6", border: "#6f63a3", text: "#544a80" },
};

export function DayViewCalendar({
  currentDate,
  doctors = [],
  onDateChange,
  onCellClick,
  keyword = "",
  onKeywordChange,
  onCreateAppointment,
  onSelectAppointment,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dentistFilter, setDentistFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);
  const chips = statusFilterButtons();

  // A busy clinic day runs to a few dozen bookings; 500 covers every dentist
  // rather than truncating the grid at an arbitrary page.
  const { data: appointments } = useAppointmentList({
    date: currentDate.format("YYYY-MM-DD"),
    maxResultCount: 500,
  });

  const allBookings = useMemo(() => appointments?.items ?? [], [appointments]);

  /** Counts for the status chips — over the whole day, before any filtering. */
  const countsByChip = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chip of statusFilterButtons()) {
      counts.set(
        chip.key,
        allBookings.filter((a) => chip.statuses.includes(a.status)).length,
      );
    }
    return counts;
  }, [allBookings]);

  const visibleBookings = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const chip = statusFilterButtons().find((c) => c.key === statusFilter);

    return allBookings.filter((a) => {
      if (dentistFilter && a.doctorId !== dentistFilter) return false;
      if (chip && !chip.statuses.includes(a.status)) return false;
      if (!needle) return true;
      return (
        a.patientName?.toLowerCase().includes(needle) ||
        a.reason?.toLowerCase().includes(needle) ||
        a.doctorName?.toLowerCase().includes(needle)
      );
    });
  }, [allBookings, dentistFilter, statusFilter, keyword]);

  /**
   * Bookings indexed by doctor and half-hour slot. A slot can hold more than one
   * card — two dentists is the normal case, but a double-booking must still be
   * visible rather than silently dropped.
   */
  const bookingsByCell = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();

    for (const appointment of visibleBookings) {
      const start = dayjs(appointment.startTime);
      const slotIndex = Math.floor(
        (start.hour() * 60 + start.minute() - DAY_START_H * 60) / SLOT_MINUTES,
      );

      if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) continue;

      const key = `${appointment.doctorId}-${slotIndex}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(appointment);
      else map.set(key, [appointment]);
    }

    return map;
  }, [visibleBookings]);

  /** Per-doctor totals for the column headers. */
  const countsByDoctor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of visibleBookings) {
      counts.set(appointment.doctorId, (counts.get(appointment.doctorId) ?? 0) + 1);
    }
    return counts;
  }, [visibleBookings]);

  const isHourStart = (slotIdx: number) => slotIdx % 2 === 0;
  const displayDate = currentDate.format("DD/MM/YYYY");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Status counter filter buttons */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 16px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        {chips.map((btn) => (
          <button
            key={btn.key}
            type="button"
            aria-pressed={statusFilter === btn.key}
            onClick={() =>
              setStatusFilter((current) => (current === btn.key ? undefined : btn.key))
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              border: `1px solid ${btn.borderColor}`,
              backgroundColor: statusFilter === btn.key ? btn.borderColor : btn.bgColor,
              color: statusFilter === btn.key ? "#fff" : btn.textColor,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: statusFilter === btn.key ? "#fff" : btn.borderColor,
                color: statusFilter === btn.key ? btn.borderColor : "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {countsByChip.get(btn.key) ?? 0}
            </span>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Toolbar row 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: "#98a4b4" }} />}
          placeholder={t("Tìm kiếm")}
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          allowClear
          style={{ maxWidth: 200 }}
        />
        <Select
          placeholder={t("Chọn bác sĩ")}
          allowClear
          value={dentistFilter}
          onChange={setDentistFilter}
          style={{ minWidth: 160 }}
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="small">{t("Xuất File")}</Button>
          <Button type="primary" size="small" style={{ background: "#1c3566" }} onClick={onCreateAppointment}>{t("Tạo lịch hẹn mới")}</Button>
          <Button size="small">{t("Tạo lịch tạm")}</Button>
          <Button size="small">{t("Xem theo giờ")}</Button>
          <Button size="small">{t("Toàn màn hình")}</Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ overflowX: "auto" }} ref={scrollRef}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${TIME_COL_W}px repeat(${Math.max(doctors.length, 1)}, ${DOCTOR_COL_W}px)`,
            minWidth: TIME_COL_W + doctors.length * DOCTOR_COL_W,
          }}
        >
          {/* Header row: time col + doctor cols */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "#fafbfd",
              borderBottom: "2px solid #e2e8f0",
              borderRight: "1px solid #e2e8f0",
              padding: "8px 4px",
              fontSize: 11,
              color: "#98a4b4",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {t("Giờ /")}<br />{t("Nhân viên")}
          </div>
          {doctors.length === 0 ? (
            <div
              style={{
                background: "#fafbfd",
                borderBottom: "2px solid #e2e8f0",
                padding: "8px",
                color: "#98a4b4",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {t("Không có bác sĩ")}
            </div>
          ) : (
            doctors.map((doc) => (
              <div
                key={doc.id}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "#fafbfd",
                  borderBottom: "2px solid #e2e8f0",
                  borderLeft: "1px solid #e2e8f0",
                  padding: "8px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#101c2c",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {doc.name}
                <span style={{ color: "#6f7c90", fontWeight: 400, marginLeft: 4 }}>
                  ({countsByDoctor.get(doc.id) ?? 0})
                </span>
              </div>
            ))
          )}

          {/* Time slots */}
          {slots.map((slotIdx) => (
            <Fragment key={`slot-${slotIdx}`}>
              {/* Time label */}
              <div
                style={{
                  borderBottom: isHourStart(slotIdx + 1) ? "1px solid #e2e8f0" : "1px dashed #f4f6fa",
                  borderRight: "1px solid #e2e8f0",
                  height: SLOT_H,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: isHourStart(slotIdx) ? "#41505f" : "#D1D5DB",
                  fontWeight: isHourStart(slotIdx) ? 500 : 400,
                  background: "#fafbfd",
                }}
              >
                {isHourStart(slotIdx) ? slotTime(slotIdx) : ""}
              </div>

              {/* Doctor cells */}
              {doctors.length === 0 ? (
                <div
                  key={`empty-${slotIdx}`}
                  style={{
                    borderBottom: isHourStart(slotIdx + 1) ? "1px solid #e2e8f0" : "1px dashed #f4f6fa",
                    borderLeft: "1px solid #e2e8f0",
                    height: SLOT_H,
                    background: slotIdx % 2 === 0 ? "#fafbfd" : "#fff",
                  }}
                />
              ) : (
                doctors.map((doc) => (
                  <div
                    key={`cell-${slotIdx}-${doc.id}`}
                    onClick={() => onCellClick?.(doc.id, slotIdx)}
                    data-testid={
                      bookingsByCell.has(`${doc.id}-${slotIdx}`) ? "calendar-booking" : undefined
                    }
                    style={{
                      borderBottom: isHourStart(slotIdx + 1) ? "1px solid #e2e8f0" : "1px dashed #f4f6fa",
                      borderLeft: "1px solid #e2e8f0",
                      height: SLOT_H,
                      background: slotIdx % 4 < 2 ? "#fafbfd" : "#fff",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#eaf0fa"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = slotIdx % 4 < 2 ? "#fafbfd" : "#fff"; }}
                  >
                    {(bookingsByCell.get(`${doc.id}-${slotIdx}`) ?? []).map((booking) => {
                      const look = CARD_LOOK[booking.status];
                      const from = dayjs(booking.startTime).format("HH:mm");
                      // A booking whose patient could not be resolved still has
                      // to be legible, so the card falls back to its reason.
                      const title =
                        booking.patientName?.trim() ||
                        booking.reason?.trim() ||
                        t("Lịch hẹn");

                      return (
                        <div
                          key={booking.id}
                          role="button"
                          tabIndex={0}
                          title={`${from} · ${title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectAppointment?.(booking.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              onSelectAppointment?.(booking.id);
                            }
                          }}
                          style={{
                            margin: "2px 3px",
                            padding: "2px 6px",
                            borderRadius: 5,
                            borderLeft: `3px solid ${look.border}`,
                            background: look.bg,
                            color: look.text,
                            fontSize: 11,
                            lineHeight: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <span style={{ opacity: 0.75, marginRight: 4 }}>{from}</span>
                          {title}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Date nav footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "8px",
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => onDateChange?.(-1)}>
          {t("Ngày trước")}
        </Button>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#101c2c" }}>{displayDate}</span>
        <Button type="text" size="small" onClick={() => onDateChange?.(1)}>
          {t("Ngày kế tiếp")} <RightOutlined />
        </Button>
      </div>
    </div>
  );
}
