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
  Check,
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
} from "../types/reception";

interface ReceptionCardProps {
  item: ReceptionItem;
  doctors?: { id: string; name: string; title: string }[];
  /** Whether an API call for this card is in flight — shows a spinner overlay. */
  busy?: boolean;
  onOutcomeChange?: (id: string, outcome: AppointmentOutcome) => void;
  onDoctorChange?: (id: string, doctorId: string) => void;
  onStatusChange?: (id: string, action: "check-in" | "start" | "complete") => void;
  onCancel?: (id: string) => void;
  /** "Đã hẹn tiếp" asks for a date first, so it opens the picker instead of saving. */
  onFollowUpClick?: (id: string) => void;
  /** Whether the follow-up picker is open under this card. */
  followUpOpen?: boolean;
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

const STEP_COLORS = ["#6366f1", "#d98b0f", "#0e9f6e"] as const;

type NonNullOutcome = Exclude<AppointmentOutcome, null>;

const OUTCOME_KEYS: NonNullOutcome[] = [
  "FollowUp",
  "EndTreatment",
  "TransferDoctor",
  "Revisit",
];

export const ReceptionCard: React.FC<ReceptionCardProps> = ({
  item,
  doctors = [],
  busy = false,
  onOutcomeChange,
  onDoctorChange,
  onStatusChange,
  onCancel,
  onFollowUpClick,
  followUpOpen = false,
  children,
}) => {
  const navigate = useNavigate();

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

  const badgeStyle = item.counterStatus ? COUNTER_STATUS_STYLE[item.counterStatus] : null;
  const badgeLabelText = item.counterStatus ? badgeLabel[item.counterStatus] : null;
  const selectedOutcome = item.selectedOutcome ?? null;

  const step1Done = !!item.step1Time;
  const step2Done = !!item.step2Time;
  const step3Done = !!item.step3Time;
  const isRevisit = selectedOutcome === "Revisit";
  const hideStep3 = isRevisit && step2Done && !step3Done;

  const isCancelled = item.counterStatus === "Cancelled";
  const isNoShow = item.counterStatus === "Late" && !item.isTimeLate;

  const canCheckIn = !step1Done && !isCancelled && !isNoShow;
  const canStart = step1Done && !step2Done && !isCancelled && !isNoShow;
  const canComplete = step2Done && !step3Done && !isCancelled && !isNoShow;

  const getCardStyle = (): React.CSSProperties => {
    if (isCancelled) return { background: "#fdeced", borderColor: "#f7c6c8" };
    if (step3Done) return { background: "#e2f4ee", borderColor: "#0e9f6e" };
    if (step1Done) return { background: "#eef0ff", borderColor: "#6366f1" };
    return {};
  };

  const getStepCircleStyle = (stepIndex: number, done: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: done ? `1px solid ${STEP_COLORS[stepIndex]}` : "1px solid #e7eaf6",
    background: done ? STEP_COLORS[stepIndex] : "#fff",
    color: done ? "#fff" : "var(--bd-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  });

  const getLineColor = (fromStep: number, toStep: number): string => {
    const steps = [step1Done, step2Done, step3Done];
    if (steps[fromStep] && steps[toStep]) return STEP_COLORS[toStep];
    if (steps[fromStep]) return STEP_COLORS[toStep];
    return "#e7eaf6";
  };

  const showCancel = !isCancelled && item.status !== "Completed" && !step3Done;

  return (
    <div className={["rc-wrapper", busy && "rc-wrapper--busy", children && "rc-wrapper--expanded"].filter(Boolean).join(" ")}>
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
                  onClick={() => item.patientId && navigate(`/patient/${item.patientId}?tab=appointment`)}
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
              <div className="rc-steps">
                <button
                  type="button"
                  disabled={!canCheckIn}
                  className={`rc-step ${canCheckIn ? "rc-step--clickable" : ""}`}
                  onClick={canCheckIn ? () => onStatusChange?.(item.id, "check-in") : undefined}
                >
                  <div className="rc-step-track">
                    <div className="rc-step-line rc-step-line--invisible" />
                    <div style={getStepCircleStyle(0, step1Done)}>
                      {step1Done ? <Check size={14} /> : "1"}
                    </div>
                    <div className="rc-step-line" style={{ background: step1Done ? STEP_COLORS[1] : "#e7eaf6" }} />
                  </div>
                  <p className="rc-step-label" style={step1Done ? { color: STEP_COLORS[0] } : undefined}>
                    {t("Reception:StatusArrived")}
                  </p>
                  <p className="rc-step-time">{item.step1Time || "--:--"}</p>
                </button>

                <button
                  type="button"
                  disabled={!canStart}
                  className={`rc-step ${canStart ? "rc-step--clickable" : ""}`}
                  onClick={canStart ? () => onStatusChange?.(item.id, "start") : undefined}
                >
                  <div className="rc-step-track">
                    <div className="rc-step-line" style={{ background: getLineColor(0, 1) }} />
                    <div style={getStepCircleStyle(1, step2Done)}>
                      {step2Done ? <Check size={14} /> : "2"}
                    </div>
                    <div className={`rc-step-line${hideStep3 ? " rc-step-line--invisible" : ""}`} style={hideStep3 ? undefined : { background: step2Done ? STEP_COLORS[2] : "#e7eaf6" }} />
                  </div>
                  <p className="rc-step-label" style={hideStep3 ? { color: "#e5484d" } : step2Done ? { color: STEP_COLORS[1] } : undefined}>
                    {hideStep3 ? t("Reception:StepRevisit") : t("Reception:StepInProgress")}
                  </p>
                  <p className="rc-step-time">{item.step2Time || "--:--"}</p>
                </button>

                {!hideStep3 && (
                  <button
                    type="button"
                    disabled={!canComplete}
                    className={`rc-step ${canComplete ? "rc-step--clickable" : ""}`}
                    onClick={canComplete ? () => onStatusChange?.(item.id, "complete") : undefined}
                  >
                    <div className="rc-step-track">
                      <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#e7eaf6" }} />
                      <div style={getStepCircleStyle(2, step3Done)}>
                        {step3Done ? <Check size={14} /> : "3"}
                      </div>
                      <div className="rc-step-line rc-step-line--invisible" />
                    </div>
                    <p className="rc-step-label" style={isRevisit ? { color: "#e5484d" } : step3Done ? { color: STEP_COLORS[2] } : undefined}>
                      {isRevisit ? t("Reception:StepRevisit") : t("Reception:StepComplete")}
                    </p>
                    <p className="rc-step-time">{item.step3Time || "--:--"}</p>
                  </button>
                )}
              </div>

              <div className="rc-doctor-select">
                <SearchSelect
                  value={item.doctorId || undefined}
                  placeholder={t("Reception:SelectDoctor")}
                  disabled={isCancelled}
                  options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                  onChange={(val) => val && onDoctorChange?.(item.id, val)}
                />
              </div>
            </div>

            {/* Col 3: outcome radio actions */}
            <div className="rc-col-actions">
              {OUTCOME_KEYS.map((key) => {
                const isFollowUp = key === "FollowUp";
                const isSelected = selectedOutcome === key || (isFollowUp && followUpOpen);
                // "Đã hẹn tiếp" locks out every other option.
                // "Kết thúc điều trị" locks out "Chuyển bác sĩ" (and vice-versa is not required).
                const isDisabled =
                  isCancelled ||
                  (selectedOutcome === "FollowUp" && key !== "FollowUp") ||
                  (selectedOutcome === "EndTreatment" && key === "TransferDoctor");
                return (
                  <button
                    key={key}
                    type="button"
                    className={["rc-outcome-btn", isSelected && "rc-outcome-btn--selected", isFollowUp && "rc-outcome-btn--stacked"]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-expanded={isFollowUp ? followUpOpen : undefined}
                    onClick={() => (isFollowUp ? onFollowUpClick?.(item.id) : onOutcomeChange?.(item.id, key))}
                  >
                    {isSelected ? (
                      <CircleCheck size={16} className="rc-outcome-icon--selected" />
                    ) : (
                      <Circle size={16} className="rc-outcome-icon" />
                    )}
                    {isFollowUp ? (
                      <span className="rc-outcome-text">
                        <span>{outcomeLabel[key]}</span>
                        <span className={`rc-outcome-sub${item.followUpAt ? " rc-outcome-sub--set" : ""}`}>
                          {item.followUpAt
                            ? dayjs(item.followUpAt).format("HH:mm DD/MM/YYYY")
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
