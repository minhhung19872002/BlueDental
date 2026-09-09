import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Modal, Spin } from "antd";
import { Printer } from "lucide-react";
import {
  usePatientMedicalRecords,
  type MedicalRecordForm,
} from "@/features/patient-management/api/medicalRecordApi";
import { MedicalRecordSheetView } from "@/features/patient-management/components/patient-detail/MedicalRecordSheetView";
import { parseFieldValues } from "@/features/patient-management/components/patient-detail/medicalRecordDraft";
import type { FieldValues } from "@/features/patient-management/components/patient-detail/medical-record/fieldValues";
import { useSheetFieldValues } from "@/features/patient-management/components/patient-detail/medical-record/useSheetFieldValues";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { t } from "@/lib/i18n";
import { isolateSheetsForPrint } from "@/features/patient-management/components/patient-detail/medical-record/printing";
import {
  clampZoom,
  DEFAULT_PRINT_FORM,
  PREVIEW_ZOOM,
  previewSheet,
} from "./printRecordPreview";
import { PrintRecordToolbar } from "./PrintRecordToolbar";
import "@/features/patient-management/components/patient-detail/medical-record/medical-record.css";
import "./print-medical-record.css";

interface Props {
  patient: PatientDto;
  onClose: () => void;
}

/**
 * "In bệnh án" — the dialog behind the clipboard button on a treatment-plan
 * row. Pick one of the nine printed forms, correct the yellow cells for this
 * one print, and print it.
 *
 * Corrections are deliberately not saved: the reference says as much in the
 * line above the preview, and the sheets themselves are edited and stored on
 * the Bệnh án tab. Measured from staging on 2026-09-09; see
 * docs/clone/pages/treatment-plan.md §In bệnh án.
 *
 * Mounted only while open, so the record files are fetched when the button is
 * pressed rather than on every visit to the tab, and so each open starts from
 * the stored sheets again — a cell corrected for one print never leaks into
 * the next.
 */
export function PrintMedicalRecordDialog({ patient, onClose }: Props) {
  const query = usePatientMedicalRecords(patient.id);
  const sheets = useMemo(() => query.data?.items ?? [], [query.data]);

  const auto = useSheetFieldValues(patient, patient.branchId);

  const [form, setForm] = useState<MedicalRecordForm>(DEFAULT_PRINT_FORM);
  const [zoom, setZoom] = useState<number>(PREVIEW_ZOOM.fit);
  const [values, setValues] = useState<FieldValues>({});

  const sheet = previewSheet(form, sheets, patient.id, patient.branchId);

  // The draft follows whichever file is chosen, and is re-seeded when the
  // server hands back a newer copy of it.
  useEffect(() => {
    setValues(parseFieldValues(sheet.content));
  }, [sheet.id, sheet.content]);

  // Set while a print is in flight, so `afterprint` can put the page back.
  const restorePage = useRef<(() => void) | null>(null);

  useEffect(() => {
    const done = () => {
      restorePage.current?.();
      restorePage.current = null;
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  const handlePrint = () => {
    restorePage.current?.();
    restorePage.current = isolateSheetsForPrint();
    window.print();
  };

  return (
    <Modal
      open
      title={t("In bệnh án")}
      width="calc(100vw - 32px)"
      className="pmr-dialog"
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pmr-foot">
          <Button onClick={onClose}>{t("Đóng")}</Button>
          <Button type="primary" icon={<Printer size={16} />} onClick={handlePrint}>
            {t("In bệnh án")}
          </Button>
        </div>
      }
    >
      <div className="pmr-body">
        <PrintRecordToolbar
          form={form}
          onFormChange={setForm}
          zoom={zoom}
          onZoomChange={(next) => setZoom(clampZoom(next))}
        />

        <div className="pmr-canvas">
          {query.isLoading ? (
            <Spin className="pmr-spin" />
          ) : (
            /*
             * The zoom is applied here rather than through the sheet's own
             * `zoom` prop: only one of the nine forms honours it, and CSS zoom
             * shrinks the layout box as well, so the scroller measures the
             * sheet at the size it is actually drawn.
             */
            <div className="pmr-scale" style={{ "--pmr-zoom": zoom } as CSSProperties}>
              <MedicalRecordSheetView
                sheet={sheet}
                auto={auto}
                zoom={1}
                editable
                values={values}
                onChange={setValues}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
