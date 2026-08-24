import React from "react";
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
  onCancel?: (id: string) => void;
}

interface CounterBadgeStyle {
  bg: string;
  border: string;
  color: string;
}

const COUNTER_STATUS_STYLE: Record<AppointmentCounterType, CounterBadgeStyle> = {
  Scheduled: { bg: "#DCEBFA", border: "#BFD6F6", color: "#1E5BB0" },
  Arrived:   { bg: "#E9F8EE", border: "#B9E6C9", color: "#237B4B" },
  Cancelled: { bg: "#FBE0E0", border: "#F3BABA", color: "#B93832" },
  Late:      { bg: "#FBEBCB", border: "#FBEBCB", color: "#9A680F" },
  Temporary: { bg: "#F9E3CC", border: "#E8C19B", color: "#B7611F" },
  Converted: { bg: "#D5ECF7", border: "#AAD7EA", color: "#176F99" },
};

const STEP_COLORS = ["#5A95F5", "#F4A62A", "#41AE63"] as const;

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
  onCancel,
}) => {
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

  const getCardStyle = (): React.CSSProperties => {
    if (step3Done) return { background: "#EAF8EF", borderColor: "#41AE63" };
    if (step1Done) return { background: "#EAF3FF", borderColor: "#5A95F5" };
    return {};
  };

  const getStepCircleStyle = (stepIndex: number, done: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: done ? `1px solid ${STEP_COLORS[stepIndex]}` : "1px solid #DCE3EE",
    background: done ? STEP_COLORS[stepIndex] : "#fff",
    color: done ? "#fff" : "#5A6B82",
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
    return "#DCE3EE";
  };

  return (
    <div className="rc-wrapper">
      <button
        type="button"
        className="rc-cancel-btn"
        aria-label={t("Hủy lịch")}
        onClick={() => onCancel?.(item.id)}
      >
        <CalendarX size={16} />
      </button>

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
                <div className="rc-patient-name">
                  {item.patientName}
                  {item.patientYearOfBirth ? ` (${item.patientYearOfBirth})` : ""}
                </div>
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
                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line rc-step-line--invisible" />
                    <div style={getStepCircleStyle(0, step1Done)}>
                      {step1Done ? <Check size={14} /> : "1"}
                    </div>
                    <div className="rc-step-line" style={{ background: step1Done ? STEP_COLORS[1] : "#DCE3EE" }} />
                  </div>
                  <p className="rc-step-label" style={step1Done ? { color: STEP_COLORS[0] } : undefined}>
                    {t("Đã đến")}
                  </p>
                  <p className="rc-step-time">{item.step1Time || "--:--"}</p>
                </button>

                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line" style={{ background: getLineColor(0, 1) }} />
                    <div style={getStepCircleStyle(1, step2Done)}>
                      {step2Done ? <Check size={14} /> : "2"}
                    </div>
                    <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#DCE3EE" }} />
                  </div>
                  <p className="rc-step-label" style={step2Done ? { color: STEP_COLORS[1] } : undefined}>
                    {t("Đang khám")}
                  </p>
                  <p className="rc-step-time">{item.step2Time || "--:--"}</p>
                </button>

                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#DCE3EE" }} />
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
