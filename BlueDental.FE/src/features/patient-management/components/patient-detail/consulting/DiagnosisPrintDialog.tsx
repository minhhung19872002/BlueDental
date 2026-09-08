import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Modal } from "antd";
import { Printer, Save, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { RichTextField } from "@/components/RichTextField";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  formatTeeth,
  type PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { useUpdateDiagnosisPrintContent } from "@/features/treatment-management/api/consultingQueries";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { DiagnosisPrintImages } from "./DiagnosisPrintImages";
import {
  DiagnosisAdvice,
  DiagnosisPrintSheet,
  type DiagnosisSheetFields,
} from "./DiagnosisPrintSheet";
import "./diagnosis-print.css";

/**
 * The wording the reference's sheet opens with when nothing has been written
 * for this diagnosis yet.
 */
const DEFAULT_ADVICE =
  "<p>Cùng với việc kiểm tra các mô nha chu, tình trạng vệ sinh răng miệng của bệnh nhân " +
  "cũng phải được đánh giá. Sự hiện diện của mảng sinh học được ghi nhận theo từng bề mặt " +
  "răng trong quá trình thăm khám.</p>" +
  "<p>Nội dung tư vấn, chỉ định điều trị và các lưu ý sau điều trị sẽ được cập nhật tại đây " +
  "trước khi in dịch vụ.</p>";

export interface PrintClinicInfo {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface PrintPatientInfo {
  code: string;
  name: string;
  dateOfBirth: string | null;
}

interface Props {
  diagnosis: PatientDiagnosisDto | null;
  clinic: PrintClinicInfo;
  patient: PrintPatientInfo;
  images: PatientImageViewModel[];
  onClose: () => void;
}

function fieldsOf(
  diagnosis: PatientDiagnosisDto,
  clinic: PrintClinicInfo,
  patient: PrintPatientInfo,
): DiagnosisSheetFields {
  return {
    clinicName: clinic.name,
    clinicAddress: clinic.address ?? "",
    clinicPhone: clinic.phone ?? "",
    patientCode: patient.code,
    patientName: patient.name,
    patientDob: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "",
    diagnosisName: diagnosis.diagnosisName ?? "",
    teeth: formatTeeth(diagnosis.teeth),
    note: diagnosis.note === "---" ? "" : (diagnosis.note ?? ""),
    adviceHtml: diagnosis.contentDiagnosis?.trim() || DEFAULT_ADVICE,
    doctorName: diagnosis.staffName ?? "",
  };
}

/**
 * "In chẩn đoán {mã phiếu}" — the dialog behind the printer button on a row of
 * Tạo chẩn đoán.
 *
 * The photographs to print are chosen on the left; the sheet on the right is
 * what will come out. "Cập nhật" turns every fact on it into an editable field
 * and puts the advice body into the rich-text editor, and the advice and the
 * note are what get saved — the rest is letterhead the user may correct for
 * this one print. Measured from the reference on 2026-09-08; see
 * docs/clone/pages/patient-detail.md.
 */
export function DiagnosisPrintDialog({ diagnosis, clinic, patient, images, onClose }: Props) {
  const save = useUpdateDiagnosisPrintContent();
  // Read by the reset below, which must not re-run when these change identity.
  const diagnosisRef = useRef(diagnosis);
  const clinicRef = useRef(clinic);
  const patientRef = useRef(patient);
  diagnosisRef.current = diagnosis;
  clinicRef.current = clinic;
  patientRef.current = patient;

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<DiagnosisSheetFields | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Every open starts from the stored row again: a sheet corrected for one
  // print must not leak into the next one.
  //
  // Keyed on the row's id, not on the props themselves. Saving invalidates the
  // consulting queries, which re-renders the tab and hands this dialog fresh
  // `clinic` / `patient` objects — and running the reset on those threw away
  // the advice that had just been written, so it only came back on a reopen.
  const diagnosisId = diagnosis?.id ?? null;
  useEffect(() => {
    if (!diagnosisRef.current) return;
    setEditing(false);
    setSelected([]);
    setFields(fieldsOf(diagnosisRef.current, clinicRef.current, patientRef.current));
  }, [diagnosisId]);

  // The letterhead arrives with the branch, which is a request of its own, so it
  // is filled in when it lands — but never over something being edited.
  useEffect(() => {
    if (editing) return;
    setFields((current) =>
      current
        ? {
            ...current,
            clinicName: clinic.name,
            clinicAddress: clinic.address ?? "",
            clinicPhone: clinic.phone ?? "",
          }
        : current,
    );
  }, [editing, clinic]);

  useEffect(() => {
    const done = () => document.body.classList.remove("pd-printing");
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  const sheetImages = useMemo(
    () =>
      images
        .filter((image) => selected.includes(image.id))
        .map((image) => ({ id: image.id, url: image.url, fileName: image.fileName })),
    [images, selected],
  );

  if (!diagnosis || !fields) return null;

  const set = (key: keyof DiagnosisSheetFields, value: string) =>
    setFields((current) => (current ? { ...current, [key]: value } : current));

  const slot = (key: keyof DiagnosisSheetFields) =>
    editing ? (
      <span
        className="dp-field"
        contentEditable
        suppressContentEditableWarning
        onBlur={(event) => set(key, event.currentTarget.textContent ?? "")}
      >
        {fields[key]}
      </span>
    ) : (
      <span>{fields[key]}</span>
    );

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        id: diagnosis.id,
        input: { contentDiagnosis: fields.adviceHtml, note: fields.note || null },
      });
      toast.success(t("Đã cập nhật phiếu chẩn đoán"));
      setEditing(false);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handlePrint = () => {
    document.body.classList.add("pd-printing");
    window.print();
  };

  /*
   * The copy that reaches the printer lives on document.body, not inside the
   * modal: the print rule hides the body's other children, and AntD's portal
   * wrapper is one of them — a descendant cannot un-hide itself.
   */
  const sheet = createPortal(
    <div className="pd-print-sheet dp-print-sheet">
      <DiagnosisPrintSheet
        images={sheetImages}
        slot={(key) => <span>{fields[key]}</span>}
        advice={<DiagnosisAdvice html={fields.adviceHtml} />}
      />
    </div>,
    document.body,
  );

  return (
    <Modal
      open
      width="calc(100vw - 64px)"
      className="dp-dialog"
      title={t("In chẩn đoán {0}", diagnosis.code)}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="dp-foot">
          {editing && (
            <Button
              icon={<Save size={16} />}
              disabled={save.isPending}
              loading={save.isPending}
              onClick={() => void handleSave()}
            >
              {t("Lưu chẩn đoán")}
            </Button>
          )}
          <Button type="primary" icon={<Printer size={16} />} onClick={handlePrint}>
            {t("In chẩn đoán")}
          </Button>
        </div>
      }
    >
      <div className="dp-grid">
        <DiagnosisPrintImages
          images={images}
          selected={selected}
          onSelectedChange={setSelected}
        />

        <div className="dp-paper">
          <div className="dp-paper-head">
            <div>
              <h3>{t("Phiếu chẩn đoán")}</h3>
              <p>{t("Chỉnh nội dung trước khi in.")}</p>
            </div>
            <Button icon={<SquarePen size={16} />} disabled={editing} onClick={() => setEditing(true)}>
              {t("Cập nhật")}
            </Button>
          </div>

          <DiagnosisPrintSheet
            images={sheetImages}
            slot={slot}
            advice={
              editing ? (
                <RichTextField
                  value={fields.adviceHtml}
                  onChange={(html) => set("adviceHtml", html)}
                />
              ) : (
                <DiagnosisAdvice html={fields.adviceHtml} />
              )
            }
          />
        </div>
      </div>
      {sheet}
    </Modal>
  );
}
