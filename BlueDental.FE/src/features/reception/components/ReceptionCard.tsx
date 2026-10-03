import React from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Folder,
  UserRound,
  Stethoscope,
  Tag,
  Clock3,
  FileText,
  CalendarX,
  Circle,
  CircleCheck,
  Loader2,
} from "lucide-react";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type {
  ReceptionItem,
  AppointmentOutcome,
  AppointmentCounterType,
  BookedOutcome,
} from "../types/reception";
import { useWaitState } from "../hooks/useWaitState";
import type { WaitLevel } from "../utils/waitTime";
import { ReceptionCardSteps } from "./ReceptionCardSteps";

interface ReceptionCardProps {
  item: ReceptionItem;
  doctors?: { id: string; name: string; title: string }[];
  /** Whether an API call for this card is in flight — shows a spinner overlay. */
  busy?: boolean;
  onOutcomeChange?: (id: string, outcome: AppointmentOutcome) => void;
  onDoctorChange?: (id: string, doctorId: string) => void;
  onStatusChange?: (id: string, action: "check-in" | "start" | "complete") => void;
  onCancel?: (id: string) => void;
  /** A "Lịch tạm" has no patient record yet: its name opens "Tạo hồ sơ" instead. */
  onTemporaryPatientClick?: (id: string) => void;
  /** "Đã hẹn tiếp" and "Hẹn tái khám" ask for a date first, so they open the picker instead of saving. */
  onFollowUpClick?: (id: string, outcome: BookedOutcome) => void;
  /** Which of the two the picker under this card is booking, if it is open. */
  pendingBooking?: BookedOutcome | null;
  /** The follow-up picker, rendered under the card while open. */
  children?: React.ReactNode;
}

interface CounterBadgeStyle {
  bg: string;
  border: string;
  color: string;
}

const COUNTER_STATUS_STYLE: Record<AppointmentCounterType, CounterBadgeStyle> = {
  Scheduled: { bg: "#eceefd", border: "#c8cafa", color: "#6366f1" },
  Arrived:   { bg: "#e2f4ee", border: "#abddcc", color: "#0e9f6e" },
  Cancelled: { bg: "#faf1e2", border: "#f2d6ab", color: "#d98b0f" },
  Late:      { bg: "#fce9ea", border: "#f6bfc1", color: "#e5484d" },
  Temporary: { bg: "#efebfb", border: "#d1c6f4", color: "#7c5ce0" },
  Converted: { bg: "#e2f2f9", border: "#abd9ee", color: "#0e94d0" },
};

/** A long wait recolours the card's edge; a short one keeps the arrived indigo. */
const WAIT_BORDER: Partial<Record<WaitLevel, string>> = {
  warning: "var(--bd-amber)",
  overdue: "var(--bd-red)",
};

type NonNullOutcome = Exclude<AppointmentOutcome, null>;

const OUTCOME_KEYS: NonNullOutcome[] = [
  "FollowUp",
  "EndTreatment",
  "TransferDoctor",
  "Revisit",
];

const BOOKED_OUTCOMES: readonly NonNullOutcome[] = ["FollowUp", "Revisit"];

const isBookedOutcome = (key: NonNullOutcome): key is BookedOutcome => BOOKED_OUTCOMES.includes(key);

type OutcomeLock = (key: NonNullOutcome, saved: AppointmentOutcome, pending: BookedOutcome | null) => boolean;

/**
 * When an option cannot be clicked. A saved "Đã hẹn tiếp" or "Hẹn tái khám"
 * locks every other option. While a picker is open only the other booked
 * option is locked, so a plain pick can still back out of it. "Kết thúc điều
 * trị" locks "Chuyển bác sĩ" and "Hẹn tái khám".
 */
const OUTCOME_LOCKS: OutcomeLock[] = [
  (key, saved) => saved !== null && isBookedOutcome(saved) && key !== saved,
  (key, _saved, pending) => pending !== null && isBookedOutcome(key) && key !== pending,
  (key, saved) => saved === "EndTreatment" && (key === "TransferDoctor" || key === "Revisit"),
];

function doctorOptionsFor(doctors: { id: string; name: string }[], item: ReceptionItem) {
  const options = doctors.map((d) => ({ value: d.id, label: d.name }));
  if (!item.doctorId || options.some((o) => o.value === item.doctorId)) return options;
  return [...options, { value: item.doctorId, label: item.doctorName }];
}

export const ReceptionCard: React.FC<ReceptionCardProps> = ({
  item,
  doctors = [],
  busy = false,
  onOutcomeChange,
  onDoctorChange,
  onStatusChange,
  onCancel,
  onFollowUpClick,
  pendingBooking = null,
  onTemporaryPatientClick,
  children,
}) => {
  const navigate = useNavigate();
  // `doctors` holds only who is free on this visit's day; the card's own
  // doctor stays listed so the select never shows a bare id.
  const doctorOptions = doctorOptionsFor(doctors, item);
  const wait = useWaitState(item);

  const badgeLabel: Record<AppointmentCounterType, string> = {
    Scheduled: t("Reception:StatusScheduled"),
    Arrived:   t("Reception:StatusArrived"),
    Cancelled: t("Reception:StatusCancelled"),
    Late:      t("Reception:StatusLate"),
    Temporary: t("Reception:StatusTemporary"),
    Converted: t("Reception:StatusConverted"),
  };

  const outcomeLabel: Record<NonNullOutcome, string> = {
    EndTreatment:   t("Reception:OutcomeEndTreatment"),
    FollowUp:       t("Reception:OutcomeFollowUp"),
    TransferDoctor: t("Reception:OutcomeTransferDoctor"),
    Revisit:        t("Reception:OutcomeRevisit"),
  };

  // "Lịch tạm" rides on the card's top edge; the badge keeps the visit's status.
  const badgeStatus = item.visitStatus ?? item.counterStatus;
  const badgeStyle = badgeStatus ? COUNTER_STATUS_STYLE[badgeStatus] : null;
  const badgeLabelText = badgeStatus ? badgeLabel[badgeStatus] : null;
  const showTemporaryTab = !!item.isTemporary;
  const selectedOutcome = item.selectedOutcome ?? null;
  // The open picker is a pending "Đã hẹn tiếp" / "Hẹn tái khám": it replaces the
  // saved tick until it is booked (the server then saves it) or backed out of
  // (the saved one returns).
  const shownOutcome: AppointmentOutcome = pendingBooking ?? selectedOutcome;

  const step1Done = !!item.step1Time;
  const step3Done = !!item.step3Time;

  const isCancelled = item.counterStatus === "Cancelled";
  const isNoShow = item.counterStatus === "Late" && !item.isTimeLate;

  const getCardStyle = (): React.CSSProperties => {
    if (isCancelled) return { background: "#fdeced", borderColor: "#f7c6c8" };
    if (step3Done) return { background: "#e2f4ee", borderColor: "#0e9f6e" };
    if (step1Done) {
      const waitBorder = wait.kind === "waiting" ? WAIT_BORDER[wait.level] : undefined;
      return { background: "#eef0ff", borderColor: waitBorder ?? "#6366f1" };
    }
    return {};
  };

  const showCancel = !isCancelled && item.status !== "Completed" && !step3Done;

  const handlePatientClick = () => {
    if (item.isTemporary) {
      onTemporaryPatientClick?.(item.id);
      return;
    }
    if (item.patientId) navigate(`/patient/${item.patientId}?tab=appointment`);
  };

  return (
    <div className={["rc-wrapper", busy && "rc-wrapper--busy", children && "rc-wrapper--expanded"].filter(Boolean).join(" ")}>
      {showTemporaryTab && <span className="rc-temp-tab">{badgeLabel.Temporary}</span>}
      {busy && (
        <div className="rc-busy-overlay">
          <Loader2 size={28} className="rc-busy-spinner" />
        </div>
      )}
      {showCancel && (
        <button
          type="button"
          className="rc-cancel-btn"
          aria-label={t("Reception:CancelAppointment")}
          onClick={() => onCancel?.(item.id)}
        >
          <CalendarX size={16} />
        </button>
      )}

      <div className="rc-card" style={getCardStyle()}>
        <div className="rc-content">
          <div className="rc-grid">
            {/* Col 1: patient info */}
            <div className="rc-col-info">
              <div className="rc-header-row">
                <div className="rc-ticket">
                  <Folder size={20} aria-hidden />
                  <span>{item.voucherCode}</span>
                </div>
                {badgeStyle && badgeLabelText && (
                  <span
                    className="rc-badge"
                    style={{ background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}`, color: badgeStyle.color }}
                  >
                    {badgeLabelText}
                  </span>
                )}
              </div>

              <div className="rc-patient-row">
                <UserRound size={20} className="rc-icon-top" aria-hidden />
                <button
                  type="button"
                  className="rc-patient-name rc-patient-name--link"
                  onClick={handlePatientClick}
                >
                  {item.patientName}
                  {item.patientYearOfBirth ? ` (${item.patientYearOfBirth})` : ""}
                </button>
              </div>

              <div className="rc-details">
                <div className="rc-detail-row">
                  <Stethoscope size={18} className="rc-icon-top" aria-hidden />
                  <span className="rc-detail-text rc-detail-bold">{item.doctorName}</span>
                </div>
                <div className="rc-detail-row">
                  <Tag size={18} className="rc-icon-top" aria-hidden />
                  <span className="rc-detail-text">
                    {item.patientType === "New" ? t("Reception:NewPatient") : t("Reception:ReturningPatient")}
                  </span>
                </div>
                {item.appointmentTime && (
                  <div className="rc-detail-row">
                    <Clock3 size={18} className="rc-icon-top" aria-hidden />
                    <span className="rc-detail-text">{item.appointmentTime}</span>
                  </div>
                )}
                <div className="rc-detail-row">
                  <FileText size={18} className="rc-icon-top" aria-hidden />
                  <span className="rc-detail-text rc-detail-notes">{item.notes || "-"}</span>
                </div>
              </div>
            </div>

            {/* Col 2: progress steps + doctor select */}
            <div className="rc-col-progress">
              <ReceptionCardSteps
                item={item}
                canAdvance={!isCancelled && !isNoShow}
                wait={wait}
                onAdvance={(action) => onStatusChange?.(item.id, action)}
              />

              <div className="rc-doctor-select">
                <SearchSelect
                  value={item.doctorId || undefined}
                  placeholder={t("Reception:SelectDoctor")}
                  disabled={isCancelled}
                  options={doctorOptions}
                  onChange={(val) => val && onDoctorChange?.(item.id, val)}
                />
              </div>
            </div>

            {/* Col 3: outcome radio actions */}
            <div className="rc-col-actions">
              {OUTCOME_KEYS.map((key) => {
                const isBooked = isBookedOutcome(key);
                const isSelected = shownOutcome === key;
                const isDisabled = isCancelled || OUTCOME_LOCKS.some((lock) => lock(key, selectedOutcome, pendingBooking));
                const bookedAt = selectedOutcome === key ? item.followUpAt : undefined;
                return (
                  <button
                    key={key}
                    type="button"
                    className={["rc-outcome-btn", isSelected && "rc-outcome-btn--selected", isBooked && "rc-outcome-btn--stacked"]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-expanded={isBooked ? pendingBooking === key : undefined}
                    onClick={() =>
                      isBookedOutcome(key) ? onFollowUpClick?.(item.id, key) : onOutcomeChange?.(item.id, key)
                    }
                  >
                    {isSelected ? (
                      <CircleCheck size={16} className="rc-outcome-icon--selected" />
                    ) : (
                      <Circle size={16} className="rc-outcome-icon" />
                    )}
                    {isBooked ? (
                      <span className="rc-outcome-text">
                        <span>{outcomeLabel[key]}</span>
                        <span className={`rc-outcome-sub${bookedAt ? " rc-outcome-sub--set" : ""}`}>
                          {bookedAt
                            ? dayjs(bookedAt).format("HH:mm DD/MM/YYYY")
                            : t("Reception:FollowUpNeedDate")}
                        </span>
                      </span>
                    ) : (
                      <span>{outcomeLabel[key]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {children && <div className="rc-followup">{children}</div>}
      </div>
    </div>
  );
};
