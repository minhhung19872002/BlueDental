import { useCallback, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Button, Input } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { toast } from "sonner";

import { AppDialog } from "@/components/AppDialog";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t, tRich } from "@/lib/i18n";
import { useRegisterLeave } from "../../api/timekeepingQueries";
import type { LeaveShift } from "../../api/timekeepingApi";
import { useLeaveDraft } from "../../hooks/useLeaveDraft";
import type { LeaveDayInfo } from "../../hooks/useLeaveRegistrationTarget";
import { LEAVE_SHIFT_OPTIONS, formatDuration, shiftLabel } from "../../utils/leaveShifts";
import { LeaveDayCard } from "./LeaveDayCard";
import { LeaveMonthCalendar } from "./LeaveMonthCalendar";
import { LeaveStaffHeader } from "./LeaveStaffHeader";

export interface LeaveStaff {
  id: string;
  name: string;
  position: string;
  avatarUrl: string | null;
}

interface Props {
  staff: LeaveStaff;
  initialMonth: Dayjs;
  getDayInfo: (date: string) => LeaveDayInfo;
  onClose: () => void;
}

const REASON_MAX = 500;
const toApiTime = (time: string) => `${time}:00`;

export function LeaveRegistrationDialog({ staff, initialMonth, getDayInfo, onClose }: Props) {
  const today = dayjs().format("YYYY-MM-DD");
  const [month, setMonth] = useState(initialMonth.startOf("month"));
  const [reason, setReason] = useState("");
  const registerLeave = useRegisterLeave();

  const resolveWindows = useCallback((date: string) => getDayInfo(date).windows, [getDayInfo]);
  const isLocked = useCallback((date: string) => getDayInfo(date).locked, [getDayInfo]);
  const draft = useLeaveDraft(resolveWindows);

  const selected = useMemo(
    () => new Map<string, LeaveShift | null>(draft.days.map((d) => [d.date, d.shift])),
    [draft.days],
  );

  const handleSave = async () => {
    try {
      await registerLeave.mutateAsync({
        staffId: staff.id,
        reason: reason.trim() || undefined,
        days: draft.days.flatMap((d) =>
          d.shift === null
            ? []
            : [{ workDate: d.date, shift: d.shift, start: toApiTime(d.start), end: toApiTime(d.end) }],
        ),
      });
      toast.success(t("Timekeeping:Leave:Saved", draft.days.length, staff.name));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const footerLeft = (
    <div className="lv-foot-summary">
      <span>{tRich("Timekeeping:Leave:SelectedDays", <strong key="n">{t("Timekeeping:Leave:DayCount", draft.days.length)}</strong>)}</span>
      <span>
        {tRich(
          "Timekeeping:Leave:Total",
          <strong key="total">{draft.isComplete ? formatDuration(draft.totalMinutes) : "—"}</strong>,
        )}
      </span>
    </div>
  );

  return (
    <AppDialog
      open
      title={t("Timekeeping:Leave:Title")}
      width={900}
      className="lv-dialog"
      canSave={draft.isComplete}
      saving={registerLeave.isPending}
      saveLabel={t("Timekeeping:Leave:Confirm")}
      saveIcon={<CalendarOutlined />}
      cancelLabel={t("Common:Cancel")}
      footerLeft={footerLeft}
      onSave={handleSave}
      onClose={onClose}
    >
      <div className="lv-body">
        <div className="lv-col">
          <LeaveStaffHeader name={staff.name} position={staff.position} avatarUrl={staff.avatarUrl} />

          <div className="lv-step">
            <h3 className="lv-step-title">{t("Timekeeping:Leave:Step1")}</h3>
            <p className="lv-step-hint">{t("Timekeeping:Leave:Step1Hint")}</p>
            <LeaveMonthCalendar
              month={month}
              today={today}
              selected={selected}
              isLocked={isLocked}
              onMonthChange={setMonth}
              onToggle={draft.toggleDate}
            />
          </div>

          <div className="lv-step">
            <h3 className="lv-step-title">{t("Timekeeping:Leave:Step2")}</h3>
            <p className="lv-step-hint">{t("Timekeeping:Leave:Step2Hint")}</p>
            <Input.TextArea
              aria-label={t("Timekeeping:Leave:Step2")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("Timekeeping:Leave:ReasonPlaceholder")}
              maxLength={REASON_MAX}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </div>
        </div>

        <div className="lv-col lv-col--days">
          <h3 className="lv-step-title">{t("Timekeeping:Leave:Step3")}</h3>
          <p className="lv-step-hint">{t("Timekeeping:Leave:Step3Hint")}</p>

          {draft.days.length === 0 ? (
            <p className="lv-empty">{t("Timekeeping:Leave:NoDays")}</p>
          ) : (
            <>
              <div className="lv-apply-all">
                <span>{t("Timekeeping:Leave:ApplyAll")}</span>
                {LEAVE_SHIFT_OPTIONS.map((shift) => (
                  <Button key={shift} size="small" onClick={() => draft.applyShiftToAll(shift)}>
                    {shiftLabel(shift)}
                  </Button>
                ))}
              </div>
              <div className="lv-day-list">
                {draft.days.map((day) => (
                  <LeaveDayCard
                    key={day.date}
                    day={day}
                    onShiftChange={draft.setShift}
                    onTimeChange={draft.setTime}
                    onRemove={draft.removeDate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
