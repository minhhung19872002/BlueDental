import { useMemo, useState } from "react";
import { Button, Empty, Input, Popover, Spin } from "antd";
import { SearchOutlined, CalendarOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";

import { Segmented } from "antd";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { TimekeepingStatChips } from "./TimekeepingStatChips";
import { TimekeepingStaffCard } from "./TimekeepingStaffCard";
import { TimekeepingWeekHeader } from "./TimekeepingWeekHeader";
import { FloatingLabel } from "@/components/FloatingLabel";
import {
  useTimeKeepingList,
  useTimeKeepingSummary,
} from "../api/timekeepingQueries";
import {
  WORK_REGISTRATION,
  ATTENDANCE_STATUS,
  WORK_SHIFT_KIND,
  type TimeKeepingRecordDto,
} from "../api/timekeepingApi";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId, useBranchFilter } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { ViewMode } from "@/features/appointments/hooks/useCalendarState";
import "./timekeeping.css";

function AttendanceGuideContent() {
  return (
    <div className="tk-guide">
      <p className="tk-guide-title">{t("Hướng dẫn điểm danh")}</p>
      <ol className="tk-guide-list">
        <li>
          <strong>{t("Đăng ký lịch:")}</strong>{" "}
          {t("mỗi ngày chọn Làm việc hoặc Nghỉ.")}
        </li>
        <li>
          <strong>{t("Điểm danh (khi đi làm):")}</strong>{" "}
          {t("bấm lần lượt 4 bước — Vào ca (check-in) → Ca sáng → Vào ca chiều → Kết ca (check-out).")}
        </li>
        <li>
          <strong>{t("Chỉ điểm danh trong ngày:")}</strong>{" "}
          {t("thao tác Vào ca / Kết ca chỉ thực hiện được trong")}
          {" "}<strong>{t("ngày hôm đó")}</strong>
          {"; "}{t("ngày đã qua không tự sửa được (trừ quản lý có quyền).")}
        </li>
        <li>
          <strong>{t("Vắng không báo trước:")}</strong>{" "}
          {t("đã đăng ký Làm việc nhưng không Vào ca → cuối ngày hệ thống tự đánh dấu Vắng.")}
        </li>
      </ol>
      <hr className="tk-guide-divider" />
      <p className="tk-guide-legend">
        {t("Trạng thái:")} 🟢 {t("Làm việc")} · ⚪ {t("Không điểm danh")} · 🔴 {t("Vắng")}
      </p>
    </div>
  );
}

interface Props {
  currentDate: Dayjs;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onDateChange: (date: Dayjs) => void;
  onOpenBuilder: () => void;
}

export function TimekeepingBoard({ currentDate, viewMode, onViewModeChange, onDateChange, onOpenBuilder }: Props) {
  const branchId = useCurrentBranchId();
  const branchFilter = useBranchFilter();
  const workDate = currentDate.format("YYYY-MM-DD");
  const [keyword, setKeyword] = useState("");

  const { data: summary } = useTimeKeepingSummary(branchFilter, workDate);
  const { data, isLoading } = useTimeKeepingList({
    clinicBranchId: branchFilter,
    fromDate: workDate,
    toDate: workDate,
    maxResultCount: 100,
  });

  const { data: staffPage, isLoading: staffLoading } = useStaffList({
    maxResultCount: 100,
    isActive: true,
    branchId: branchFilter,
  });
  const records = useMemo(() => {
    const tkItems = data?.items ?? [];
    const staffItems = staffPage?.items ?? [];

    const tkByStaffId = new Map(tkItems.map((r) => [r.staffId, r]));

    const merged: TimeKeepingRecordDto[] = staffItems
      .filter((staff) => !staff.creationTime || dayjs(staff.creationTime).format("YYYY-MM-DD") <= workDate)
      .map((staff) => {
      const existing = tkByStaffId.get(staff.id);
      if (existing) return existing;

      const ms = staff.morningStartTime ?? "08:00:00";
      const me = staff.morningEndTime ?? "12:00:00";
      const as = staff.afternoonStartTime ?? "13:00:00";
      const ae = staff.afternoonEndTime ?? "17:00:00";

      const buildShift = (kind: 1 | 2, start: string, end: string) => ({
        kind,
        plannedStart: start,
        plannedEnd: end,
        checkedInAt: null,
        checkedOutAt: null,
        plannedMinutes: 240,
        workedMinutes: 0,
        isOpen: false,
      });

      return {
        id: `virtual-${staff.id}`,
        staffId: staff.id,
        clinicBranchId: branchId,
        workDate,
        registration: WORK_REGISTRATION.NotRegistered,
        status: ATTENDANCE_STATUS.NotStarted,
        morningShift: buildShift(WORK_SHIFT_KIND.Morning, ms, me),
        afternoonShift: buildShift(WORK_SHIFT_KIND.Afternoon, as, ae),
        overtimeMinutes: 0,
        totalWorkedMinutes: 0,
        leaveReason: null,
        note: null,
        recordedByStaffId: null,
        staffName: staff.fullName || staff.userName,
        staffPosition: staff.roleNames[0] ?? null,
      };
    });

    for (const tk of tkItems) {
      if (!staffItems.some((s) => s.id === tk.staffId)) {
        merged.push(tk);
      }
    }

    if (!keyword.trim()) return merged;
    const needle = keyword.trim().toLowerCase();
    return merged.filter((r) => (r.staffName ?? "").toLowerCase().includes(needle));
  }, [data, staffPage, keyword, branchId, branchFilter, workDate]);

  const staffCreationDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffPage?.items ?? []) {
      map.set(s.id, dayjs(s.creationTime).format("YYYY-MM-DD"));
    }
    return map;
  }, [staffPage]);

  return (
    <>
      {/* Row 1 — reuses cal-toolbar-row1 so it's flush with the tab bar */}
      <div className="cal-toolbar-row1">
        <Segmented
          value={viewMode}
          onChange={(v) => onViewModeChange(v as ViewMode)}
          options={[
            { label: t("Ngày"), value: "day" },
            { label: t("Tuần"), value: "week" },
            { label: t("Tháng"), value: "month", disabled: true },
          ]}
        />
        <DateNavigator
          value={currentDate}
          mode={viewMode}
          onChange={onDateChange}
        />
        <TimekeepingStatChips summary={summary} />
      </div>

      {/* Row 2 — reuses cal-toolbar-row2 */}
      <div className="cal-toolbar-row2">
        <div className="cal-toolbar-row2-left">
          <FloatingLabel label={t("Tìm kiếm")} floated={Boolean(keyword)}>
            <Input
              prefix={<SearchOutlined style={{ color: "#98a4b4" }} />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              maxLength={100}
            />
          </FloatingLabel>
          <Popover
            content={<AttendanceGuideContent />}
            trigger="hover"
            placement="bottomLeft"
            overlayClassName="tk-guide-popover"
            overlayInnerStyle={{ background: "#1B2A41", padding: 16, borderRadius: 10 }}
            overlayStyle={{ maxWidth: 380 }}
          >
            <button
              type="button"
              className="tk-info-btn"
              aria-label={t("Hướng dẫn điểm danh")}
            >
              <InfoCircleOutlined style={{ fontSize: 20 }} />
            </button>
          </Popover>
        </div>
        <div className="cal-toolbar-row2-right">
          <Button
            type="primary"
            icon={<CalendarOutlined />}
            onClick={onOpenBuilder}
          >
            {t("Lịch làm việc")}
          </Button>
        </div>
      </div>

      {/* Week header */}
      {viewMode === "week" && (
        <TimekeepingWeekHeader currentDate={currentDate} onDayClick={onDateChange} />
      )}

      {/* Grid — reuses cal-grid-wrap for bottom rounding */}
      <div className="cal-grid-wrap">
        <div className="tk-board">
          {isLoading || staffLoading ? (
            <div className="tk-empty">
              <Spin />
            </div>
          ) : records.length === 0 ? (
            <Empty description={t("Chưa có dữ liệu chấm công cho ngày này")} />
          ) : (
            <div className="tk-grid">
              {records.map((record) => (
                <TimekeepingStaffCard
                  key={record.id}
                  record={record}
                  staffCreationDate={staffCreationDates.get(record.staffId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
