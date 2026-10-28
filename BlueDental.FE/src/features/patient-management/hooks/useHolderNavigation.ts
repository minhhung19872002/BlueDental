import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { describeApiError } from "@/lib/apiError";
import { withBranch, useCurrentBranchId } from "@/lib/clinicBranch";
import { notifyError } from "@/lib/notify";
import { useFetchPatientDto } from "../api/patientQueries";
import type { PatientDto, PhoneOwner } from "../types/patient";

interface Options {
  /** The flow that wants a patient back (a booking, a reception, the Zalo panel); absent on the Bệnh nhân page and in edit. */
  onCreated?: (patient: PatientDto) => void;
  onClose: () => void;
}

/**
 * What a hồ sơ row in the phone's dropdown does (P2710_02). Inside a flow the
 * row is the answer — that hồ sơ goes back to the flow instead of a duplicate —
 * and "Mở hồ sơ ›" opens it in a new tab so the flow is not lost. Elsewhere
 * both leave the dialog for that hồ sơ's page.
 */
export function useHolderNavigation({ onCreated, onClose }: Options) {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const fetchPatient = useFetchPatientDto();

  const recordUrl = useCallback((owner: PhoneOwner) => withBranch(`/patient/${owner.id}`, branchId), [branchId]);

  const goToRecord = useCallback(
    (owner: PhoneOwner) => {
      onClose();
      navigate(recordUrl(owner));
    },
    [navigate, onClose, recordUrl],
  );

  const onPickOwner = useCallback(
    async (owner: PhoneOwner) => {
      if (!onCreated) {
        goToRecord(owner);
        return;
      }
      try {
        onCreated(await fetchPatient(owner.id));
        onClose();
      } catch (error) {
        notifyError(describeApiError(error).message);
      }
    },
    [fetchPatient, goToRecord, onClose, onCreated],
  );

  const onOpenOwner = useCallback(
    (owner: PhoneOwner) => {
      if (onCreated) window.open(recordUrl(owner), "_blank", "noopener");
      else goToRecord(owner);
    },
    [goToRecord, onCreated, recordUrl],
  );

  return { onPickOwner, onOpenOwner };
}
