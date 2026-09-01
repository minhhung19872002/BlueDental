import { useMemo, useState, useCallback } from "react";
import { Button, Input, Modal, Spin } from "antd";
import {
  SearchOutlined,
  LeftOutlined,
  UndoOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import dayjs, { type Dayjs } from "dayjs";

import { FloatingLabel } from "@/components/FloatingLabel";
import { WorkScheduleTable } from "./WorkScheduleTable";
import type { CellKind } from "./WorkScheduleCell";
import { useTimeKeepingList, useBulkRegister } from "../api/timekeepingQueries";
import {
  WORK_REGISTRATION,
  type WorkRegistration,
  type TimeKeepingRecordDto,
} from "../api/timekeepingApi";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { useBranchFilter } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" /><path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const UserCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

interface Props {
  currentDate: Dayjs;
  onBack: () => void;
}

export function WorkScheduleBuilder({ currentDate, onBack }: Props) {
  const branchFilter = useBranchFilter();
  const [builderMonth, setBuilderMonth] = useState(() => currentDate.startOf("month"));
  const [keyword, setKeyword] = useState("");
  const [localChanges, setLocalChanges] = useState<Map<string, WorkRegistration>>(new Map());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkRegister = useBulkRegister();

  const fromDate = builderMonth.startOf("month").format("YYYY-MM-DD");
  const toDate = builderMonth.endOf("month").format("YYYY-MM-DD");

  const { data: tkData, isLoading: tkLoading } = useTimeKeepingList({
    clinicBranchId: branchFilter,
    fromDate,
    toDate,
    maxResultCount: 500,
  });

  const { data: staffPage, isLoading: staffLoading } = useStaffList({
    maxResultCount: 200,
    isActive: true,
    branchId: branchFilter,
  });

  const today = dayjs().format("YYYY-MM-DD");

  const tkLookup = useMemo(() => {
    const map = new Map<string, TimeKeepingRecordDto>();
    for (const r of tkData?.items ?? []) {
      map.set(`${r.staffId}:${r.workDate}`, r);
    }
    return map;
  }, [tkData]);

  const staffCreationDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staffPage?.items ?? []) {
      if (s.creationTime) map.set(s.id, dayjs(s.creationTime).format("YYYY-MM-DD"));
    }
    return map;
  }, [staffPage]);

  const staffRows = useMemo(() => {
    const items = staffPage?.items ?? [];
    const needle = keyword.trim().toLowerCase();
    const filtered = needle
      ? items.filter((s) => (s.fullName || s.userName || "").toLowerCase().includes(needle))
      : items;
    return filtered.map((s) => ({
      id: s.id,
      name: s.fullName || s.userName,
      position: s.roleNames?.[0] ?? t("Nhân viên"),
    }));
  }, [staffPage, keyword]);

  const getCellKind = useCallback(
    (staffId: string, dateStr: string): CellKind => {
      const key = `${staffId}:${dateStr}`;
      const record = tkLookup.get(key);
      const isPast = dateStr < today;
      const hasAttendance = !!(record?.morningShift?.checkedInAt || record?.afternoonShift?.checkedInAt);

      const localReg = localChanges.get(key);
      const hasLocalChange = localReg !== undefined;

      const effectiveReg = hasLocalChange
        ? localReg
        : (record?.registration ?? WORK_REGISTRATION.NotRegistered);

      if (isPast) {
        if (hasAttendance || effectiveReg === WORK_REGISTRATION.Working) return "working";
        if (effectiveReg === WORK_REGISTRATION.DayOff) return "day-off";
        const createdAt = staffCreationDates.get(staffId);
        if (createdAt && dateStr < createdAt) return "empty-past";
        return "vang";
      }

      if (hasLocalChange) {
        if (effectiveReg === WORK_REGISTRATION.DayOff) return "day-off";
        return "empty-future";
      }
      if (hasAttendance || effectiveReg === WORK_REGISTRATION.Working) return "working";
      if (effectiveReg === WORK_REGISTRATION.DayOff) return "day-off";
      return "empty-future";
    },
    [tkLookup, localChanges, today, staffCreationDates],
  );

  const handleCellClick = useCallback(
    (staffId: string, dateStr: string) => {
      const key = `${staffId}:${dateStr}`;
      const record = tkLookup.get(key);

      if (dateStr < today) return;

      const hasAttendance = !!(record?.morningShift?.checkedInAt || record?.afternoonShift?.checkedInAt);
      const currentReg = localChanges.has(key)
        ? localChanges.get(key)!
        : hasAttendance
          ? WORK_REGISTRATION.Working
          : (record?.registration ?? WORK_REGISTRATION.NotRegistered);

      let nextReg: WorkRegistration;
      if (currentReg === WORK_REGISTRATION.Working) {
        nextReg = WORK_REGISTRATION.NotRegistered;
      } else if (currentReg === WORK_REGISTRATION.NotRegistered) {
        nextReg = WORK_REGISTRATION.DayOff;
      } else {
        nextReg = WORK_REGISTRATION.NotRegistered;
      }

      setLocalChanges((prev) => {
        const next = new Map(prev);
        const serverReg = record?.registration ?? WORK_REGISTRATION.NotRegistered;
        if (nextReg === serverReg && !hasAttendance) {
          next.delete(key);
        } else {
          next.set(key, nextReg);
        }
        return next;
      });
    },
    [tkLookup, localChanges, today],
  );

  const handleStaffSelect = useCallback((staffId: string, checked: boolean) => {
    setSelectedStaff((prev) => {
      const next = new Set(prev);
      if (checked) next.add(staffId);
      else next.delete(staffId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedStaff(new Set(staffRows.map((s) => s.id)));
      } else {
        setSelectedStaff(new Set());
      }
    },
    [staffRows],
  );

  const handleBulkDayOff = useCallback(() => {
    if (selectedStaff.size === 0) return;

    const endOfMonth = builderMonth.endOf("month");
    const todayDj = dayjs();
    const startDay = builderMonth.isSame(todayDj, "month")
      ? todayDj
      : builderMonth.startOf("month");

    setLocalChanges((prev) => {
      const next = new Map(prev);
      for (const staffId of selectedStaff) {
        let d = startDay.startOf("day");
        while (d.isBefore(endOfMonth) || d.isSame(endOfMonth, "day")) {
          const dateStr = d.format("YYYY-MM-DD");
          if (dateStr >= today) {
            const key = `${staffId}:${dateStr}`;
            const record = tkLookup.get(key);
            if (!(record?.morningShift?.checkedInAt || record?.afternoonShift?.checkedInAt)) {
              const serverReg = record?.registration ?? WORK_REGISTRATION.NotRegistered;
              if (WORK_REGISTRATION.DayOff === serverReg) {
                next.delete(key);
              } else {
                next.set(key, WORK_REGISTRATION.DayOff);
              }
            }
          }
          d = d.add(1, "day");
        }
      }
      return next;
    });
  }, [selectedStaff, builderMonth, today, tkLookup]);

  const handleReset = () => setLocalChanges(new Map());

  const [saveScope, setSaveScope] = useState<"all" | "selected">("all");

  const handleSaveClick = () => {
    if (localChanges.size === 0) return;
    setSaveScope("all");
    setConfirmOpen(true);
  };

  const handleSaveSelectedClick = () => {
    if (selectedStaff.size === 0) return;
    setSaveScope("selected");
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const entries = Array.from(localChanges.entries());
    const filtered = saveScope === "selected"
      ? entries.filter(([key]) => selectedStaff.has(key.split(":")[0]))
      : entries;

    if (filtered.length === 0) {
      setConfirmOpen(false);
      return;
    }

    const items = filtered.map(([key, registration]) => {
      const [staffId, workDate] = key.split(":");
      return { staffId, workDate, registration };
    });

    try {
      await bulkRegister.mutateAsync({ items });
      toast.success(t("Đã lưu lịch làm việc cho {0} ô.").replace("{0}", String(items.length)));
      if (saveScope === "selected") {
        setLocalChanges((prev) => {
          const next = new Map(prev);
          for (const [key] of filtered) next.delete(key);
          return next;
        });
      } else {
        setLocalChanges(new Map());
      }
      setConfirmOpen(false);
    } catch (error) {
      toast.error(extractApiError(error));
      setConfirmOpen(false);
    }
  };

  const handleMonthPrev = () => {
    setBuilderMonth((m) => m.subtract(1, "month"));
    setLocalChanges(new Map());
    setSelectedStaff(new Set());
  };

  const handleMonthNext = () => {
    setBuilderMonth((m) => m.add(1, "month"));
    setLocalChanges(new Map());
    setSelectedStaff(new Set());
  };

  const hasChanges = localChanges.size > 0;
  const loading = tkLoading || staffLoading;

  const dayOffCount = useMemo(() => {
    const counted = new Set<string>();
    let count = 0;
    for (const r of tkData?.items ?? []) {
      const key = `${r.staffId}:${r.workDate}`;
      if (localChanges.has(key)) continue;
      if (r.registration === WORK_REGISTRATION.DayOff) {
        count++;
        counted.add(key);
      }
    }
    for (const [key, reg] of localChanges) {
      if (reg === WORK_REGISTRATION.DayOff && !counted.has(key)) count++;
    }
    return count;
  }, [tkData, localChanges]);

  const allSelected = staffRows.length > 0 && selectedStaff.size === staffRows.length;

  return (
    <div className="wsb-wrap">
      <div className="wsb-toolbar">
        <div className="wsb-toolbar-left">
          <Button icon={<LeftOutlined />} onClick={onBack}>
            {t("Quay lại")}
          </Button>

          <div className="wsb-toolbar-search">
            <FloatingLabel label={t("Tìm nhân viên...")} floated={Boolean(keyword)}>
              <Input
                prefix={<SearchOutlined style={{ color: "#98a4b4" }} />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
                maxLength={100}
              />
            </FloatingLabel>
          </div>

          <div className="wsb-month-nav">
            <button
              type="button"
              className="wsb-month-nav-btn"
              onClick={handleMonthPrev}
              aria-label={t("Tháng trước")}
            >
              <ChevronLeftIcon />
            </button>
            <span className="wsb-month-nav-label">
              {t("Tháng")} {builderMonth.month() + 1}
            </span>
            <button
              type="button"
              className="wsb-month-nav-btn"
              onClick={handleMonthNext}
              aria-label={t("Tháng sau")}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        <div className="wsb-toolbar-actions">
          <Button
            icon={<UndoOutlined />}
            disabled={!hasChanges || bulkRegister.isPending}
            onClick={handleReset}
          >
            {t("Đặt lại")}
          </Button>
          {selectedStaff.size > 0 && (
            <Button
              icon={<UserCheckIcon />}
              loading={bulkRegister.isPending && saveScope === "selected"}
              onClick={handleSaveSelectedClick}
            >
              {t("Lưu lịch với nhân viên đã chọn ({0})").replace("{0}", String(selectedStaff.size))}
            </Button>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            disabled={!hasChanges}
            loading={bulkRegister.isPending && saveScope === "all"}
            onClick={handleSaveClick}
          >
            {t("Lưu thay đổi")}
          </Button>
        </div>
      </div>

      <div className="wsb-legend-bar">
        <div className="wsb-legend-items">
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#16A34A" }} />
            {t("Làm")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#DC2626" }} />
            {t("Nghỉ")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-dot" style={{ background: "#F59E0B" }} />
            {t("Vắng mặt không báo trước")}
          </span>
          <span className="wsb-legend-item">
            <span className="wsb-legend-half">
              <SunIcon />
              <MoonIcon />
            </span>
            {t("Làm nửa buổi (sáng / chiều)")}
          </span>
        </div>
      </div>

      <div className="wsb-help">
        <strong style={{ color: "#16A34A" }}>{t("Làm")}</strong>
        {" / "}
        <strong style={{ color: "#7C5CFC" }}>{t("Làm nửa buổi")}</strong>
        {" "}
        {t("chỉ tính khi nhân viên đã vào ca. Ngày chưa vào ca để trống; quá khứ không vào ca sẽ hiện Vắng.")}
      </div>

      {selectedStaff.size > 0 && (
        <div className="wsb-selection-note">
          {t("Nút nhân viên đã chọn chỉ lưu các dòng đã tick; Lưu lịch lưu tất cả thay đổi đang có trên bảng.")}
        </div>
      )}

      <div className="wsb-table-area">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
            <Spin />
          </div>
        ) : (
          <WorkScheduleTable
            month={builderMonth}
            staff={staffRows}
            getCellKind={getCellKind}
            onCellClick={handleCellClick}
            dayOffCount={dayOffCount}
            selectedStaff={selectedStaff}
            allSelected={allSelected}
            onStaffSelect={handleStaffSelect}
            onSelectAll={handleSelectAll}
            onDayOffClick={handleBulkDayOff}
          />
        )}
      </div>

      <Modal
        open={confirmOpen}
        title={saveScope === "selected" ? t("Lưu lịch nhân viên đã chọn") : t("Lưu lịch làm việc")}
        width={450}
        onCancel={() => setConfirmOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfirmOpen(false)}>
            {t("Hủy")}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={bulkRegister.isPending}
            onClick={handleConfirmSave}
          >
            {t("Xác nhận lưu")}
          </Button>,
        ]}
      >
        <p>
          {saveScope === "selected"
            ? t("Bạn có chắc muốn lưu lịch cho {0} nhân viên đã chọn trong").replace("{0}", String(selectedStaff.size))
            : t("Bạn có chắc muốn lưu toàn bộ thay đổi lịch làm việc trong")}
        </p>
        <p>
          <strong>{t("Tháng")} {builderMonth.month() + 1} / {builderMonth.year()}</strong>?
        </p>
      </Modal>
    </div>
  );
}
