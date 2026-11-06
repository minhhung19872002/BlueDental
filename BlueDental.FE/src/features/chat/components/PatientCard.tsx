import React from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { UserRound } from "lucide-react";
import { useBranchFilter, withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { ChatPatientCardDto, ChatVisitStatus } from "../types";

/** Today's visit, in the Tiếp nhận wording and colours. */
const VISIT_STATUS: Record<ChatVisitStatus, { labelKey: string; modifier: string }> = {
  1: { labelKey: "Chat:Visit:Scheduled", modifier: "scheduled" },
  2: { labelKey: "Chat:Visit:Late", modifier: "late" },
  3: { labelKey: "Chat:Visit:Arrived", modifier: "arrived" },
  4: { labelKey: "Chat:Visit:InTreatment", modifier: "treating" },
  5: { labelKey: "Chat:Visit:Completed", modifier: "done" },
  6: { labelKey: "Chat:Visit:Cancelled", modifier: "cancelled" },
};

interface PatientCardProps {
  patient: ChatPatientCardDto;
}

const VisitLine: React.FC<PatientCardProps> = ({ patient }) => {
  if (!patient.appointmentAt) return <span className="chat-patient-card-line">{t("Chat:PatientNoVisitToday")}</span>;
  const status = patient.visitStatus ? VISIT_STATUS[patient.visitStatus] : null;
  return (
    <>
      <span className="chat-patient-card-line">
        {t("Chat:PatientAppointment")}: {dayjs(patient.appointmentAt).format("HH:mm")}
        {patient.dentistName && ` · ${t("Chat:PatientDentist")}: ${patient.dentistName}`}
        {status && (
          <span className={`chat-visit chat-visit--${status.modifier}`}>{t(status.labelKey)}</span>
        )}
      </span>
      {patient.bookingContent && (
        <span className="chat-patient-card-line chat-patient-card-booking">
          {t("Chat:PatientBooking")}: {patient.bookingContent}
        </span>
      )}
    </>
  );
};

/**
 * A patient tagged in a message (R-1161), as the server built it for this
 * viewer: name, Mã KH, year of birth and today's visit — never a phone
 * number, history, allergy or diagnosis. Opens the record when the viewer may
 * see it; otherwise only the name and Mã KH, and it does not open.
 */
export const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  const branchId = useBranchFilter();
  if (patient.missing) {
    return <div className="chat-patient-card chat-patient-card--missing">{t("Chat:PatientMissing")}</div>;
  }

  const body = (
    <>
      <span className="chat-patient-card-head">
        <UserRound size={14} aria-hidden />
        <span className="chat-patient-card-name">{patient.name}</span>
      </span>
      <span className="chat-patient-card-line">
        {t("Chat:PatientCode")}: {patient.patientCode}
        {patient.yearOfBirth && ` · ${t("Chat:PatientBirthYear")}: ${patient.yearOfBirth}`}
      </span>
      {patient.canOpen && <VisitLine patient={patient} />}
    </>
  );

  if (!patient.canOpen) return <div className="chat-patient-card">{body}</div>;
  return (
    <Link
      className="chat-patient-card chat-patient-card--link"
      to={withBranch(`/patient/${patient.id}?tab=profile`, branchId)}
      aria-label={t("Chat:PatientOpen", patient.name ?? "")}
    >
      {body}
    </Link>
  );
};

interface PatientCardsProps {
  patients: ChatPatientCardDto[];
}

/** The cards under a message, in the order the patients were tagged. */
export const PatientCards: React.FC<PatientCardsProps> = ({ patients }) => (
  <ul className="chat-patient-cards" aria-label={t("Chat:PatientCards")}>
    {patients.map((patient) => (
      <li key={patient.id}>
        <PatientCard patient={patient} />
      </li>
    ))}
  </ul>
);
