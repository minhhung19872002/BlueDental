import React from "react";
import { SearchSelect } from "@/components/SearchSelect";
import type {
  ReceptionItem,
  AppointmentOutcome,
  AppointmentCounterType,
} from "../types/reception";
import { t } from "@/lib/i18n";

interface ReceptionCardProps {
  item: ReceptionItem;
  doctors?: { id: string; name: string; title: string }[];
  onOutcomeChange?: (id: string, outcome: AppointmentOutcome) => void;
  onDoctorChange?: (id: string, doctorId: string) => void;
  onCancel?: (id: string) => void;
}

const counterStatusBadge = (): Record<
  AppointmentCounterType,
  { label: string; bg: string; border: string; color: string }
> => ({
  Scheduled: { label: t("Đã hẹn"),     bg: "#DCEBFA", border: "#BFD6F6", color: "#1E5BB0" },
  Arrived:   { label: t("Đã đến"),     bg: "#DDF3E7", border: "#BDE8CF", color: "#1F7A45" },
  Cancelled: { label: t("Huỷ hẹn"),   bg: "#FBE0E0", border: "#F3BABA", color: "#B93832" },
  Late:      { label: t("Trễ hẹn"),   bg: "#FBEBCB", border: "#FBEBCB", color: "#9A680F" },
  Temporary: { label: t("Lịch tạm"),  bg: "#F9E3CC", border: "#E8C19B", color: "#B7611F" },
  Converted: { label: t("Chuyển đổi"), bg: "#D5ECF7", border: "#AAD7EA", color: "#176F99" },
});

const outcomes = (): { key: AppointmentOutcome; label: string }[] => [
  { key: "EndTreatment",   label: t("Kết thúc điều trị") },
  { key: "FollowUp",       label: t("Đã hẹn tiếp") },
  { key: "TransferDoctor", label: t("Chuyển bác sĩ") },
  { key: "Revisit",        label: t("Hẹn tái khám") },
];

export const ReceptionCard: React.FC<ReceptionCardProps> = ({
  item,
  doctors = [],
  onOutcomeChange,
  onDoctorChange,
  onCancel,
}) => {
  const badge = item.counterStatus ? counterStatusBadge()[item.counterStatus] : null;
  const selectedOutcome = item.selectedOutcome ?? null;

  const step1Done = !!item.step1Time;
  const step2Done = !!item.step2Time;
  const step3Done = !!item.step3Time;

  const STEP_COLORS = ["#2671D8", "#F59E0B", "#10B981"] as const;

  const getStepCircleStyle = (stepIndex: number, done: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: done ? "none" : "1px solid #DCE3EE",
    background: done ? STEP_COLORS[stepIndex] : "#fff",
    color: done ? "#fff" : "#5A6B82",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  });

  return (
    <div className="rc-wrapper">
      {/* Cancel button */}
      <button
        type="button"
        className="rc-cancel-btn"
        aria-label={t("Hủy lịch")}
        onClick={() => onCancel?.(item.id)}
      >
        {/* calendar-x icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4"/><path d="M16 2v4"/>
          <rect width="18" height="18" x="3" y="4" rx="2"/>
          <path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>
        </svg>
      </button>

      {/* Card body */}
      <div
        className="rc-card"
        style={
          step3Done
            ? { background: "#F0FDF4", borderColor: "#BBF7D0" }
            : step1Done && !step2Done
            ? { background: "#EFF6FF", borderColor: "#BFDBFE" }
            : undefined
        }
      >
        <div className="rc-content">
          <div className="rc-grid">
            {/* ── Col 1: patient info ── */}
            <div className="rc-col-info">
              {/* Ticket + badge */}
              <div className="rc-header-row">
                <div className="rc-ticket">
                  {/* folder icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                  </svg>
                  <span>{item.voucherCode}</span>
                </div>
                {badge && (
                  <span
                    className="rc-badge"
                    style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                )}
              </div>

              {/* Patient name */}
              <div className="rc-patient-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>
                </svg>
                <div className="rc-patient-name">
                  {item.patientName}
                  {item.patientYearOfBirth ? ` (${item.patientYearOfBirth})` : ""}
                </div>
              </div>

              {/* Details */}
              <div className="rc-details">
                <div className="rc-detail-row">
                  {/* stethoscope */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/>
                    <path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>
                  </svg>
                  <span className="rc-detail-text rc-detail-bold">{item.doctorName}</span>
                </div>
                <div className="rc-detail-row">
                  {/* tag */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>
                    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
                  </svg>
                  <span className="rc-detail-text">{item.patientType === "New" ? t("Khách mới") : t("Khách cũ")}</span>
                </div>
                {item.appointmentTime && (
                  <div className="rc-detail-row">
                    {/* clock */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>
                    </svg>
                    <span className="rc-detail-text">{item.appointmentTime}</span>
                  </div>
                )}
                {item.notes && (
                  <div className="rc-detail-row">
                    {/* file-text */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                      <path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
                    </svg>
                    <span className="rc-detail-text rc-detail-notes">{item.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Col 2: progress steps + doctor select ── */}
            <div className="rc-col-progress">
              <div className="rc-steps">
                {/* Step 1 */}
                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line rc-step-line--invisible" />
                    <div style={getStepCircleStyle(0, step1Done)}>
                      {step1Done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-9"/></svg>
                      ) : "1"}
                    </div>
                    <div className="rc-step-line" style={{ background: step1Done ? STEP_COLORS[1] : "#DCE3EE" }} />
                  </div>
                  <p className="rc-step-label">{step1Done ? <span style={{ color: STEP_COLORS[0] }}>{t("Đã đến")}</span> : t("Đã đến")}</p>
                  <p className="rc-step-time">{item.step1Time || "--:--"}</p>
                </button>
                {/* Step 2 */}
                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line" style={{ background: step1Done ? STEP_COLORS[1] : "#DCE3EE" }} />
                    <div style={getStepCircleStyle(1, step2Done)}>
                      {step2Done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-9"/></svg>
                      ) : "2"}
                    </div>
                    <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#DCE3EE" }} />
                  </div>
                  <p className="rc-step-label">{step2Done ? <span style={{ color: STEP_COLORS[1] }}>{t("Đang khám")}</span> : t("Đang khám")}</p>
                  <p className="rc-step-time">{item.step2Time || "--:--"}</p>
                </button>
                {/* Step 3 */}
                <button type="button" disabled className="rc-step">
                  <div className="rc-step-track">
                    <div className="rc-step-line" style={{ background: step2Done ? STEP_COLORS[2] : "#DCE3EE" }} />
                    <div style={getStepCircleStyle(2, step3Done)}>
                      {step3Done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-9"/></svg>
                      ) : "3"}
                    </div>
                    <div className="rc-step-line rc-step-line--invisible" />
                  </div>
                  <p className="rc-step-label">{step3Done ? <span style={{ color: STEP_COLORS[2] }}>{t("Hoàn tất")}</span> : t("Hoàn tất")}</p>
                  <p className="rc-step-time">{item.step3Time || "--:--"}</p>
                </button>
              </div>

              {/* Doctor select */}
              <div className="rc-doctor-select">
                <SearchSelect
                  value={item.doctorId || undefined}
                  placeholder={t("Chọn bác sĩ")}
                  options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                  onChange={(val) => val && onDoctorChange?.(item.id, val)}
                />
              </div>
            </div>

            {/* ── Col 3: outcome radio actions ── */}
            <div className="rc-col-actions">
              {outcomes().map((o) => {
                const isSelected = selectedOutcome === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    className={`rc-outcome-btn ${isSelected ? "rc-outcome-btn--selected" : ""}`}
                    onClick={() => onOutcomeChange?.(item.id, o.key)}
                  >
                    {isSelected ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#2671D8" }}>
                        <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#D0D8E5" }}>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                    )}
                    <span>{o.label}</span>
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
