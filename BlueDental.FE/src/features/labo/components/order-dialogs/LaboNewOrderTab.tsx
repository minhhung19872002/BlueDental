import { useDentistList } from "@/features/staff/api/staffQueries";
import { useTreatmentPlans } from "@/features/treatment-management/api/treatmentPlanApi";
import { LaboNewOrderForm } from "./LaboNewOrderForm";

interface Props {
  open: boolean;
  branchId: string;
  patient: { id: string; code: string; name: string };
  onSaved: () => void;
}

/**
 * "Đặt mới" from the Labo tab: no công đoạn behind it, so the plan, the
 * service line and the doctor are picked in the header (LaboSourcePickers)
 * and the source follows from them. This only fetches what those pickers list.
 */
export function LaboNewOrderTab({ open, branchId, patient, onSaved }: Props) {
  const plans = useTreatmentPlans(patient.id, branchId);
  const dentists = useDentistList();
  return (
    <LaboNewOrderForm
      open={open}
      branchId={branchId}
      patient={patient}
      lists={{
        plans: plans.data?.items ?? [],
        dentists: (dentists.data ?? []).map((staff) => ({
          value: staff.id,
          label: staff.fullName,
        })),
      }}
      onSaved={onSaved}
    />
  );
}
