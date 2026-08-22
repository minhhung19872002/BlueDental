import { useMemo, useRef } from "react";
import { Button, Input } from "antd";
import { SearchOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";

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
}

const STATUS_FILTER_BUTTONS = [
  { key: "scheduled",  label: "Đã hẹn",      borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
  { key: "arrived",    label: "Đã đến",      borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
  { key: "cancelled",  label: "Huỷ hẹn",     borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
  { key: "late",       label: "Trễ hẹn",     borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  { key: "temporary",  label: "Lịch tạm",    borderColor: "#F97316", bgColor: "#FFEDD5", textColor: "#F97316" },
  { key: "converted",  label: "Chuyển đổi",  borderColor: "#06B6D4", bgColor: "#CFFAFE", textColor: "#06B6D4" },
];

export function DayViewCalendar({
  currentDate,
  doctors = [],
  onDateChange,
  onCellClick,
  keyword = "",
  onKeywordChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);
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
          borderBottom: "1px solid #E5E7EB",
          flexWrap: "wrap",
        }}
      >
        {STATUS_FILTER_BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              border: `1px solid ${btn.borderColor}`,
              backgroundColor: btn.bgColor,
              color: btn.textColor,
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
                backgroundColor: btn.borderColor,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              0
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
          borderBottom: "1px solid #E5E7EB",
          flexWrap: "wrap",
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
          placeholder="Tìm kiếm"
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          allowClear
          style={{ maxWidth: 200 }}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="small">Xuất File</Button>
          <Button type="primary" size="small">Tạo lịch hẹn mới</Button>
          <Button size="small">Tạo lịch tạm</Button>
          <Button size="small">Xem theo giờ</Button>
          <Button size="small">Toàn màn hình</Button>
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
              background: "#F8FAFC",
              borderBottom: "2px solid #E5E7EB",
              borderRight: "1px solid #E5E7EB",
              padding: "8px 4px",
              fontSize: 11,
              color: "#9CA3AF",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Giờ /<br />Nhân viên
          </div>
          {doctors.length === 0 ? (
            <div
              style={{
                background: "#F8FAFC",
                borderBottom: "2px solid #E5E7EB",
                padding: "8px",
                color: "#9CA3AF",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Không có bác sĩ
            </div>
          ) : (
            doctors.map((doc) => (
              <div
                key={doc.id}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "#F8FAFC",
                  borderBottom: "2px solid #E5E7EB",
                  borderLeft: "1px solid #E5E7EB",
                  padding: "8px 4px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1B2A41",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {doc.name}
                {doc.appointmentCount !== undefined && (
                  <span style={{ color: "#6B7280", fontWeight: 400, marginLeft: 4 }}>
                    ({doc.appointmentCount})
                  </span>
                )}
              </div>
            ))
          )}

          {/* Time slots */}
          {slots.map((slotIdx) => (
            <>
              {/* Time label */}
              <div
                key={`time-${slotIdx}`}
                style={{
                  borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                  borderRight: "1px solid #E5E7EB",
                  height: SLOT_H,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: isHourStart(slotIdx) ? "#374151" : "#D1D5DB",
                  fontWeight: isHourStart(slotIdx) ? 500 : 400,
                  background: "#FAFAFA",
                }}
              >
                {isHourStart(slotIdx) ? slotTime(slotIdx) : ""}
              </div>

              {/* Doctor cells */}
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
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => onDateChange?.(-1)}>
          Ngày trước
        </Button>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#1B2A41" }}>{displayDate}</span>
        <Button type="text" size="small" onClick={() => onDateChange?.(1)}>
          Ngày kế tiếp <RightOutlined />
        </Button>
      </div>
    </div>
  );
}
