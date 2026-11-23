import { createPortal } from "react-dom";
import { PrinterOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { useFullAddress } from "@/hooks/useFullAddress";
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
 * the browser's print preview with only that sheet on an A4 page (R-1302).
 *
 * Mounted only while a slip is being viewed, so the print hook's cleanup runs
 * when it closes.
 */
export function PrescriptionViewDialog({ patient, prescription, onClose }: Props) {
  const print = usePrintSheet();
  const { street, provinceCode, wardCode, oldAddress } = patient.address;
  // The pre-2025 address only when the record has no current one.
  const patientAddress = useFullAddress({ street, provinceCode, wardCode }) || (oldAddress?.trim() ?? "");
  const sheet = (
    <PrescriptionPrintSheet
      patient={patient}
      patientAddress={patientAddress}
      prescription={prescription}
    />
  );

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
