import { Plus } from "lucide-react";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";

interface Props {
  plan: TreatmentPlanSlipDto;
  onOpen: (plan: TreatmentPlanSlipDto) => void;
}

/**
 * "Số phiếu điều trị": the green + that used to open "Thêm công đoạn" merged
 * with the DT code into one button that opens the slip's own screen (owner,
 * 2026-10-15). The icon is decoration — the button reads as the code alone.
 */
export function PlanCodeLink({ plan, onOpen }: Props) {
  return (
    <button type="button" className="tp-code" onClick={() => onOpen(plan)}>
      <span className="tp-code-icon" aria-hidden="true">
        <Plus size={16} />
      </span>
      {plan.code}
    </button>
  );
}
