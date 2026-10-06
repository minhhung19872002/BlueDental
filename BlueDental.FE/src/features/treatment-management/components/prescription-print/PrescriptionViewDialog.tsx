import { createPortal } from "react-dom";
import { PrinterOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { usePrintSheet } from "@/hooks/usePrintSheet";
import { t } from "@/lib/i18n";
import type { PrescriptionDto } from "../../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { PrescriptionPrintSheet } from "./PrescriptionPrintSheet";
import "./prescription-print.css";

interface Props {
  patient: PrescriptionPatientSummary;
  prescription: PrescriptionDto;
  onClose: () => void;
}

/**
 * "Xem đơn thuốc {mã}" — the printer button on a row of the Đơn thuốc tab.
 * Shows the slip read-only as it will come out on paper; "In đơn thuốc" opens
 * the browser's print preview with only that sheet on an A4 page.
 *
 * Mounted only while a slip is being viewed, so the print hook's cleanup runs
 * when it closes.
 */
export function PrescriptionViewDialog({ patient, prescription, onClose }: Props) {
  const clinic = useBranchInfo(prescription.clinicBranchId).data;
  const print = usePrintSheet();
  const sheet = <PrescriptionPrintSheet clinic={clinic} patient={patient} prescription={prescription} />;

  return (
    <AppDialog
      open
      width={880}
      className="rx-view-dialog"
      title={t("Treatment:RxPrint:ViewTitle", prescription.code)}
      canSave
      saveLabel={t("Treatment:RxPrint:PrintAction")}
      saveIcon={<PrinterOutlined />}
      cancelLabel={t("Common:Close")}
      onSave={print}
      onClose={onClose}
    >
      <div className="rx-view-paper">{sheet}</div>
      {/* The copy that reaches the printer sits on <body>, outside AntD's
          portal wrapper, which the print rule hides along with the page. */}
      {createPortal(<div className="pd-print-sheet rx-print-sheet">{sheet}</div>, document.body)}
    </AppDialog>
  );
}
