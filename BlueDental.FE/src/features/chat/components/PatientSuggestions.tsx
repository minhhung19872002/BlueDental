import React from "react";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { CHAT_LIMITS, type ChatPatientSuggestionDto, type PatientSuggestStatus } from "../types";
import { ChatSpinner } from "./ChatSpinner";
import { ChatStatus } from "./ChatStatus";

interface PatientSuggestionsProps {
  id: string;
  items: ChatPatientSuggestionDto[];
  activeIndex: number;
  status: PatientSuggestStatus;
  onRetry: () => void;
  onHover: (index: number) => void;
  onPick: (patient: ChatPatientSuggestionDto) => void;
}

export function suggestionOptionId(listId: string, index: number): string {
  return `${listId}-${index}`;
}

/**
 * The # list above the text box (R-1161): "Tên (năm sinh) · Mã KH · Hôm nay
 * HH:mm". The text box keeps the focus; a click picks without blurring it.
 */
export const PatientSuggestions: React.FC<PatientSuggestionsProps> = ({
  id,
  items,
  activeIndex,
  status,
  onRetry,
  onHover,
  onPick,
}) => {
  const renderBody = () => {
    if (status === "limit") return <ChatStatus text={t("Chat:PatientLimit", CHAT_LIMITS.maxPatientsPerMessage)} />;
    if (status === "loading") return <ChatSpinner size="small" />;
    if (status === "error") return <ChatStatus text={t("Chat:LoadError")} onRetry={onRetry} />;
    if (items.length === 0) return <ChatStatus text={t("Chat:PatientNotFound")} />;
    return (
      <ul id={id} role="listbox" aria-label={t("Chat:PatientSuggestions")} className="chat-patient-suggest-list">
        {items.map((patient, index) => (
          <li
            key={patient.id}
            id={suggestionOptionId(id, index)}
            role="option"
            aria-selected={index === activeIndex}
            className={["chat-patient-suggest-item", index === activeIndex && "chat-patient-suggest-item--active"]
              .filter(Boolean)
              .join(" ")}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(patient)}
          >
            <span className="chat-patient-suggest-name">
              {patient.yearOfBirth ? `${patient.name} (${patient.yearOfBirth})` : patient.name}
            </span>
            <span className="chat-patient-suggest-code">{patient.patientCode}</span>
            {patient.todayAt && (
              <span className="chat-patient-suggest-today">
                {t("Chat:PatientToday", dayjs(patient.todayAt).format("HH:mm"))}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="chat-patient-suggest" aria-live="polite">
      <div className="chat-patient-suggest-title">{t("Chat:PatientSuggestions")}</div>
      {renderBody()}
    </div>
  );
};
