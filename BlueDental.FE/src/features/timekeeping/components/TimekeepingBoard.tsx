import { useMemo, useState } from "react";
import { Button, Empty, Input, Spin, Switch, Tag, Tooltip, message } from "antd";
import type { Dayjs } from "dayjs";
import {
  useCheckIn,
  useCheckOut,
  useOpenWorkDay,
  useRegisterDayOff,
  useRegisterWorking,
  useTimeKeepingList,
  useTimeKeepingSummary,
} from "../api/timekeepingQueries";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { extractApiError } from "@/lib/apiError";
import {
  ATTENDANCE_STATUS,
  WORK_REGISTRATION,
  type AttendanceStatus,
  type TimeKeepingRecordDto,
  type WorkShiftDto,
  type WorkShiftKind,
} from "../api/timekeepingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

/** The translator, so helpers below can take it as a parameter. */
type Translate = (vietnamese: string, ...params: (string | number)[]) => string;

interface TimekeepingBoardProps {
  currentDate: Dayjs;
}

function getStatusConfig(t: Translate): Record<AttendanceStatus, { label: string; color: string }> {
  return {
    [ATTENDANCE_STATUS.NotStarted]: { label: t("Chưa vào ca"), color: "default" },
    [ATTENDANCE_STATUS.Working]: { label: t("Đang làm việc"), color: "processing" },
    [ATTENDANCE_STATUS.Completed]: { label: t("Hoàn thành"), color: "success" },
    [ATTENDANCE_STATUS.Abandoned]: { label: t("Nghỉ ngang"), color: "error" },
    [ATTENDANCE_STATUS.OnLeave]: { label: t("Nghỉ"), color: "warning" },
  };
}

/** "08:00:00" -> "08:00" */
function formatPlanned(time: string): string {
  return time.slice(0, 5);
}

/** ISO timestamp -> "08:05", or the reference's "--" placeholder. */
function formatStamp(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "--:--";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--bd-ink)", lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--bd-muted)" }}>{label}</div>
    </div>
  );
}

function ShiftRow({
  shift,
  disabled,
  onCheckIn,
  onCheckOut,
}: {
  shift: WorkShiftDto;
  disabled: boolean;
  onCheckIn: (kind: WorkShiftKind) => void;
  onCheckOut: (kind: WorkShiftKind) => void;
}) {
  const canCheckIn = !shift.checkedInAt;
  const action = canCheckIn ? () => onCheckIn(shift.kind) : () => onCheckOut(shift.kind);
  const actionLabel = canCheckIn ? t("Vào ca") : shift.isOpen ? t("Ra ca") : t("Đã ra ca");
  const clickable = !disabled && (canCheckIn || shift.isOpen);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--bd-sub)", minWidth: 96 }}>
        {formatPlanned(shift.plannedStart)} - {formatPlanned(shift.plannedEnd)}
      </span>
      <span style={{ fontSize: 13, color: "var(--bd-muted)", minWidth: 84, textAlign: "center" }}>
        {formatStamp(shift.checkedInAt)} / {formatStamp(shift.checkedOutAt)}
      </span>
      <Tooltip title={disabled ? t("Nhân viên đã đăng ký nghỉ") : undefined}>
        <button
          type="button"
          disabled={!clickable}
          onClick={clickable ? action : undefined}
          style={{
            border: "1px solid var(--bd-line)",
            borderRadius: 6,
            background: clickable ? "#fff" : "var(--bd-bg)",
            color: clickable ? "var(--bd-ink)" : "var(--bd-faint)",
            fontSize: 12,
            padding: "2px 10px",
            cursor: clickable ? "pointer" : "not-allowed",
          }}
        >
          {actionLabel}
        </button>
      </Tooltip>
    </div>
  );
}

function StaffCard({ record }: { record: TimeKeepingRecordDto }) {
  const registerWorking = useRegisterWorking();
  const registerDayOff = useRegisterDayOff();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const isDayOff = record.registration === WORK_REGISTRATION.DayOff;
  const status = getStatusConfig(t)[record.status];

  const handleRegistrationChange = (checked: boolean) => {
    const mutation = checked ? registerWorking.mutateAsync(record.id) : registerDayOff.mutateAsync({ id: record.id });
    void mutation.catch(() => message.error(t("Không thể đổi đăng ký sau khi đã chấm công.")));
  };

  const handleCheckIn = (shift: WorkShiftKind) => {
    void checkIn
      .mutateAsync({ id: record.id, input: { shift } })
      .catch(() => message.error(t("Không thể vào ca.")));
  };

  const handleCheckOut = (shift: WorkShiftKind) => {
    void checkOut
      .mutateAsync({ id: record.id, input: { shift } })
      .catch(() => message.error(t("Không thể ra ca.")));
  };

  return (
    <div
      style={{
        border: "1px solid var(--bd-line)",
        borderRadius: 10,
        padding: 12,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch
            size="small"
            checked={record.registration === WORK_REGISTRATION.Working}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            onChange={handleRegistrationChange}
          />
          <div>
            <div style={{ fontWeight: 600, color: "var(--bd-ink)" }}>
              {record.staffName ?? t("Nhân viên")}
            </div>
            <div style={{ fontSize: 12, color: "var(--bd-muted)" }}>
              {t("Vị trí")}: {record.staffPosition ?? t("Nhân viên")}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "var(--bd-ink)" }}>
            {formatDuration(record.totalWorkedMinutes)}
          </div>
          <Tag color={status.color} style={{ marginInlineEnd: 0, marginTop: 2 }}>
            {status.label}
          </Tag>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed var(--bd-line)", paddingTop: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--bd-faint)",
            letterSpacing: 0.4,
          }}
        >
          <span>{t("LỊCH LÀM VIỆC")}</span>
          <span>{t("VÀO CA - RA CA")}</span>
          <span />
        </div>
        <ShiftRow
          shift={record.morningShift}
          disabled={isDayOff}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
        <ShiftRow
          shift={record.afternoonShift}
          disabled={isDayOff}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      </div>

      {record.overtimeMinutes > 0 && (
        <div style={{ fontSize: 12, color: "var(--bd-muted)" }}>
          {t("Tăng ca")}: {formatDuration(record.overtimeMinutes)}
        </div>
      )}
    </div>
  );
}

/**
 * "Lịch làm việc" board — KPI bar plus one attendance card per staff member,
 * matching the reference layout at /calendar?tab=timekeeping.
 */
export function TimekeepingBoard({ currentDate }: TimekeepingBoardProps) {
  const branchId = useCurrentBranchId();
  const workDate = currentDate.format("YYYY-MM-DD");
  const [keyword, setKeyword] = useState("");

  const { data: summary } = useTimeKeepingSummary(branchId, workDate);
  const { data, isLoading } = useTimeKeepingList({
    clinicBranchId: branchId,
    fromDate: workDate,
    toDate: workDate,
    maxResultCount: 100,
  });

  const { data: staffPage } = useStaffList({ maxResultCount: 100, isActive: true });
  const openWorkDay = useOpenWorkDay();

  /**
   * Attendance cards only exist once a work day has been opened for each staff
   * member. The reference opens the day as part of its own scheduling; here it is
   * an explicit action so nothing is created behind the user's back.
   */
  const handleOpenWorkDay = async () => {
    const staff = staffPage?.items ?? [];

    if (staff.length === 0) {
      message.error(t("Chưa có nhân viên nào đang làm việc."));
      return;
    }

    try {
      for (const member of staff) {
        await openWorkDay.mutateAsync({
          staffId: member.id,
          clinicBranchId: branchId,
          workDate,
        });
      }
      message.success(t("Đã mở ngày làm việc cho {0} nhân viên", staff.length));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const records = useMemo(() => {
    const items = data?.items ?? [];
    if (!keyword.trim()) return items;
    const needle = keyword.trim().toLowerCase();
    return items.filter((r) => (r.staffName ?? "").toLowerCase().includes(needle));
  }, [data, keyword]);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "#fff",
          border: "1px solid var(--bd-line)",
          borderRadius: 10,
        }}
      >
        <StatTile value={summary?.totalStaff ?? 0} label={t("Tổng CBNV")} />
        <StatTile value={summary?.registeredWorking ?? 0} label={t("Đăng kí làm")} />
        <StatTile value={summary?.registeredDayOff ?? 0} label={t("Đăng kí nghỉ")} />
        <StatTile value={summary?.currentlyWorking ?? 0} label={t("Đang làm việc")} />
        <StatTile value={summary?.abandoned ?? 0} label={t("Nghỉ ngang")} />
        <StatTile value={formatDuration(summary?.totalOvertimeMinutes ?? 0)} label={t("Giờ tăng ca")} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Input.Search
          allowClear
          placeholder={t("Tìm kiếm...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Button
          type="primary"
          loading={openWorkDay.isPending}
          onClick={handleOpenWorkDay}
        >
          {t("Mở ngày làm việc")}
        </Button>
      </div>

      {isLoading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin />
        </div>
      ) : records.length === 0 ? (
        <Empty description={t("Chưa có dữ liệu chấm công cho ngày này")} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 12,
          }}
        >
          {records.map((record) => (
            <StaffCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
