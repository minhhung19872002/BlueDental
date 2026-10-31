import { useEffect, useRef } from "react";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboPrintSheet } from "./LaboPrintSheet";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";
import { useLaboPrint } from "./useLaboPrint";

interface Props {
  /** The order «Gửi Labo & in phiếu» just sent. */
  order: LaboOrderDto;
  branchId: string;
  patient: LaboDetailPatient;
  /** Once the print preview is closed. */
  onDone: () => void;
}

/**
 * «Gửi Labo & in phiếu» (P3110 m139, REQ-C10): the Phiếu Labo of the order
 * just sent goes to the printer by itself as soon as the clinic's letterhead
 * is in. Chrome, Edge and Firefox hold window.print() until the preview
 * closes, so the dialog is let go right after it.
 */
export function LaboAutoPrint({ order, branchId, patient, onDone }: Props) {
  const clinic = useBranchInfo(branchId);
  const print = useLaboPrint(order.orderCode);
  const printed = useRef(false);
  const ready = clinic.data !== undefined;
  const failed = clinic.isError;

  // The order is sent either way: without the letterhead it is printed later from In Phiếu Labo.
  useEffect(() => {
    if ((!ready && !failed) || printed.current) return;
    printed.current = true;
    if (ready) print();
    onDone();
  }, [ready, failed, print, onDone]);

  if (!clinic.data) return null;
  return (
    <LaboPrintSheet
      clinic={clinic.data}
      patient={patient}
      orderCode={order.orderCode}
      facts={laboOrderFacts(order, patient)}
    />
  );
}
