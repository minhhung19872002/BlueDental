import type { ReactNode } from "react";
import { RichTextView } from "@/components/RichTextView";
import { t } from "@/lib/i18n";

export interface DiagnosisSheetFields {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  patientCode: string;
  patientName: string;
  patientDob: string;
  diagnosisName: string;
  teeth: string;
  note: string;
  adviceHtml: string;
  doctorName: string;
}

export interface SheetImage {
  id: string;
  url: string;
  fileName: string;
}

interface Props {
  images: SheetImage[];
  /** Renders one field; the dialog wraps it so it can be edited in place. */
  slot: (key: keyof DiagnosisSheetFields) => ReactNode;
  /** The advice body, either read-only or the editor. */
  advice: ReactNode;
}

/**
 * "PHIẾU CHẨN ĐOÁN" — the sheet inside the "In chẩn đoán" dialog and, in a
 * second copy off-screen, what reaches the printer.
 *
 * Laid out as the reference prints it: a three-column head (clinic, title,
 * patient), the chosen photographs, the note, the advice body, and two
 * signature blocks. Times New Roman throughout, as the reference sets it.
 */
export function DiagnosisPrintSheet({ images, slot, advice }: Props) {
  const hasImages = images.length > 0;

  return (
    <div className="dp-sheet">
      <div className="dp-sheet-head">
        <div>
          <p>
            <strong>{t("Patient:Diagnosis:ClinicLabel")}:</strong> {slot("clinicName")}
          </p>
          <p>
            {t("Patient:Diagnosis:AddressLabel")}: {slot("clinicAddress")}
          </p>
          <p>
            {t("Patient:Diagnosis:PhoneLabel")}: {slot("clinicPhone")}
          </p>
        </div>
        <div className="dp-sheet-title">
          <h1>{t("Patient:Diagnosis:SheetTitle")}</h1>
          <p>{t("Patient:Diagnosis:ClinicType")}</p>
        </div>
        <div className="dp-sheet-customer">
          <p>
            <strong>{t("Patient:Diagnosis:PatientCode")}:</strong> {slot("patientCode")}
          </p>
          <p>
            <strong>{t("Patient:Diagnosis:PatientName")}:</strong> {slot("patientName")}
          </p>
          <p>
            <strong>{t("Patient:Diagnosis:PatientDob")}:</strong> {slot("patientDob")}
          </p>
          <p>
            <strong>{t("Patient:Diagnosis:DiagnosisName")}:</strong> {slot("diagnosisName")}
          </p>
          <p className="dp-sheet-teeth">
            <strong>{t("Patient:Diagnosis:TeethLabel")}:</strong> {slot("teeth")}
          </p>
        </div>
      </div>

      {hasImages && (
        <>
          <h2>{t("Patient:Diagnosis:ImagesSection")}</h2>
          <div className="dp-sheet-images">
            {images.map((image) => (
              <div key={image.id} className="dp-sheet-frame">
                <img src={image.url} alt={image.fileName} />
              </div>
            ))}
          </div>
        </>
      )}

      <p className="dp-sheet-note">
        <strong>{t("Patient:Diagnosis:Note")}:</strong> {slot("note")}
      </p>

      <h2>{hasImages ? t("Patient:Diagnosis:ConsultSection2") : t("Patient:Diagnosis:ConsultSection1")}</h2>
      {advice}

      <div className="dp-sheet-signs">
        <div>
          <h3>{t("Patient:Diagnosis:SigningDoctor")}</h3>
          <strong>{slot("doctorName")}</strong>
          <em>{t("Patient:Diagnosis:SignHint")}</em>
        </div>
        <div>
          <h3>{t("Patient:Diagnosis:Customer")}</h3>
          <strong>{slot("patientName")}</strong>
          <em>{t("Patient:Diagnosis:SignHint")}</em>
        </div>
      </div>
    </div>
  );
}

/** The read-only advice body, used on screen and on the printed copy. */
export function DiagnosisAdvice({ html }: { html: string }) {
  return <RichTextView className="dp-sheet-advice" html={html} />;
}
