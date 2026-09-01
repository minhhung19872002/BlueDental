import React from "react";
import { useNavigate } from "react-router-dom";
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
  onOutcomeChange?: (id: string, outcome: AppointmentOutcome) => void;
  onDoctorChange?: (id: string, doctorId: string) => void;
  onStatusChange?: (id: string, action: "check-in" | "start" | "complete") => void;
  onCancel?: (id: string) => void;
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
  "EndTreatment",
  "FollowUp",
  "TransferDoctor",
  "Revisit",
];

export const ReceptionCard: React.FC<ReceptionCardProps> = ({
  item,
  doctors = [],
  onOutcomeChange,
  onDoctorChange,
  onStatusChange,
  onCancel,
}) => {
  const navigate = useNavigate();

  const badgeLabel: Record<AppointmentCounterType, string> = {
    Scheduled: t("Đã hẹn"),
    Arrived:   t("Đã đến"),
    Cancelled: t("Huỷ hẹn"),
    Late:      t("Trễ hẹn"),
    Temporary: t("Lịch tạm"),
    Converted: t("Chuyển đổi"),
  };

  const outcomeLabel: Record<NonNullOutcome, string> = {
    EndTreatment:   t("Kết thúc điều trị"),
    FollowUp:       t("Đã hẹn tiếp"),
    TransferDoctor: t("Chuyển bác sĩ"),
    Revisit:        t("Hẹn tái khám"),
  };

  const badgeStyle = item.counterStatus ? COUNTER_STATUS_STYLE[item.counterStatus] : null;
  const badgeLabelText = item.counterStatus ? badgeLabel[item.counterStatus] : null;
  const selectedOutcome = item.selectedOutcome ?? null;

  const step1Done = !!item.step1Time;
  const step2Done = !!item.step2Time;
  const step3Done = !!item.step3Time;

  const isCancelled = item.counterStatus === "Cancelled";
  const isNoShow = item.counterStatus === "Late";

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
    <div className="rc-wrapper">
      {showCancel && (
        <button
          type="button"
          className="rc-cancel-btn"
          aria-label={t("Hủy lịch")}
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
                    {item.patientType === "New" ? t("Khách mới") : t("Khách cũ")}
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
                    {t("Đã đến")}
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
                    <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#e7eaf6" }} />
                  </div>
                  <p className="rc-step-label" style={step2Done ? { color: STEP_COLORS[1] } : undefined}>
                    {t("Đang khám")}
                  </p>
                  <p className="rc-step-time">{item.step2Time || "--:--"}</p>
                </button>

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
                  <p className="rc-step-label" style={step3Done ? { color: STEP_COLORS[2] } : undefined}>
                    {t("Hoàn tất")}
                  </p>
                  <p className="rc-step-time">{item.step3Time || "--:--"}</p>
                </button>
              </div>

              <div className="rc-doctor-select">
                <SearchSelect
                  value={item.doctorId || undefined}
                  placeholder={t("Chọn bác sĩ")}
                  disabled={isCancelled}
                  options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                  onChange={(val) => val && onDoctorChange?.(item.id, val)}
                />
              </div>
            </div>

            {/* Col 3: outcome radio actions */}
            <div className="rc-col-actions">
              {OUTCOME_KEYS.map((key) => {
                const isSelected = selectedOutcome === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`rc-outcome-btn ${isSelected ? "rc-outcome-btn--selected" : ""}`}
                    disabled={isCancelled}
                    onClick={() => onOutcomeChange?.(item.id, key)}
                  >
                    {isSelected ? (
                      <CircleCheck size={16} className="rc-outcome-icon--selected" />
                    ) : (
                      <Circle size={16} className="rc-outcome-icon" />
                    )}
                    <span>{outcomeLabel[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
