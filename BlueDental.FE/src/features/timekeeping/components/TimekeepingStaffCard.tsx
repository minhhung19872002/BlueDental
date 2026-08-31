import { useState } from "react";
import { toast } from "sonner";

import { WorkStatusToggle } from "./WorkStatusToggle";
import { ShiftTimeline } from "./ShiftTimeline";
import { TimekeepingInfoModal } from "./TimekeepingInfoModal";
import {
  WORK_REGISTRATION,
  type TimeKeepingRecordDto,
  type WorkRegistration,
  type WorkShiftKind,
} from "../api/timekeepingApi";
import {
  useCheckIn,
  useCheckOut,
  useOpenWorkDay,
  useRegisterDayOff,
  useRegisterWorking,
} from "../api/timekeepingQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import dayjs from "dayjs";

interface Props {
  record: TimeKeepingRecordDto;
  staffCreationDate?: string;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "--:--";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatPlanned(time: string): string {
  return time.slice(0, 5);
}

function formatStamp(value: string | null): string {
  if (!value) return "--";
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6h4" />
  </svg>
);

const MoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);

export function TimekeepingStaffCard({ record, staffCreationDate }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const branchId = useCurrentBranchId();
  const openWorkDay = useOpenWorkDay();
  const registerWorking = useRegisterWorking();
  const registerDayOff = useRegisterDayOff();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const isVirtual = record.id.startsWith("virtual-");
  const isPastDay = dayjs(record.workDate).isBefore(dayjs(), "day");
  const isNotRegistered = record.registration === WORK_REGISTRATION.NotRegistered;
  const isDayOff = record.registration === WORK_REGISTRATION.DayOff;
  const isBeforeCreation = staffCreationDate ? record.workDate < staffCreationDate : false;
  const isAbsent = isPastDay && isNotRegistered && !isBeforeCreation;
  const hasAttendance = Boolean(
    record.morningShift.checkedInAt || record.afternoonShift.checkedInAt,
  );

  const handleRegistrationChange = async (reg: WorkRegistration) => {
    if (reg === record.registration) return;
    if (hasAttendance) {
      toast.error(t("Không thể đổi đăng ký sau khi đã chấm công."));
      return;
    }
    try {
      let recordId = record.id;
      if (isVirtual) {
        const created = await openWorkDay.mutateAsync({
          staffId: record.staffId,
          clinicBranchId: branchId,
          workDate: record.workDate,
        });
        recordId = created.id;
      }
      if (reg === WORK_REGISTRATION.Working) {
        await registerWorking.mutateAsync(recordId);
      } else if (reg === WORK_REGISTRATION.DayOff) {
        await registerDayOff.mutateAsync({ id: recordId });
      }
    } catch {
      toast.error(
        reg === WORK_REGISTRATION.Working
          ? t("Không thể đăng ký làm việc.")
          : t("Không thể đăng ký nghỉ."),
      );
    }
  };

  const handleCheckIn = (shift: WorkShiftKind) => {
    void checkIn
      .mutateAsync({ id: record.id, input: { shift } })
      .catch(() => toast.error(t("Không thể vào ca.")));
  };

  const handleCheckOut = (shift: WorkShiftKind) => {
    void checkOut
      .mutateAsync({ id: record.id, input: { shift } })
      .catch(() => toast.error(t("Không thể ra ca.")));
  };

  return (
    <div className="tk-card">
      <div className="tk-card-body">
        <div className="tk-card-header">
          <WorkStatusToggle
            value={record.registration}
            disabled={hasAttendance || isPastDay}
            onChange={handleRegistrationChange}
          />
          <div className="tk-card-header-right">
            {!isAbsent && (
              <ShiftTimeline
                morningShift={record.morningShift}
                afternoonShift={record.afternoonShift}
                disabled={isDayOff || isPastDay}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
              />
            )}
            <button
              type="button"
              className="tk-more-btn"
              aria-label={t("Cập nhật thông tin")}
              onClick={() => setInfoOpen(true)}
            >
              <MoreIcon />
            </button>
          </div>
        </div>

        {isAbsent && (
          <p className="tk-card-absence">{t("Vắng không báo trước")}</p>
        )}

        <div className="tk-card-info">
          <div className="tk-avatar">
            <UserIcon />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="tk-card-name">
              {record.staffName ?? t("Nhân viên")}
            </p>
            <div className="tk-card-position">
              <span className="tk-card-position-label">{t("Vị trí")}:</span>
              <span className="tk-card-position-tag">
                {record.staffPosition ?? t("Nhân viên")}
              </span>
            </div>
          </div>
          <span className="tk-time-badge">
            <ClockIcon />
            {formatDuration(record.totalWorkedMinutes)}
          </span>
        </div>
      </div>

      <div className="tk-card-footer">
        {isAbsent ? (
          <>
            <div>
              <p className="tk-footer-title">{t("Lịch làm việc")}</p>
              <p className="tk-footer-time">--</p>
            </div>
            <div className="tk-footer-right">
              <p className="tk-footer-title">{t("Vào ca - Ra ca")}</p>
              <p className="tk-footer-time">-- / --</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="tk-footer-title">{t("Lịch làm việc")}</p>
              <div className="tk-footer-times">
                <p className="tk-footer-time">
                  {formatPlanned(record.morningShift.plannedStart)} - {formatPlanned(record.morningShift.plannedEnd)}
                </p>
                <p className="tk-footer-time">
                  {formatPlanned(record.afternoonShift.plannedStart)} - {formatPlanned(record.afternoonShift.plannedEnd)}
                </p>
              </div>
            </div>
            <div className="tk-footer-right">
              <p className="tk-footer-title">{t("Vào ca - Ra ca")}</p>
              <div className="tk-footer-times">
                <p className="tk-footer-time">
                  {formatStamp(record.morningShift.checkedInAt)} / {formatStamp(record.morningShift.checkedOutAt)}
                </p>
                <p className="tk-footer-time">
                  {formatStamp(record.afternoonShift.checkedInAt)} / {formatStamp(record.afternoonShift.checkedOutAt)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <TimekeepingInfoModal
        open={infoOpen}
        record={record}
        onClose={() => setInfoOpen(false)}
      />
    </div>
  );
}
