import { useState } from "react";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboDetailDialog } from "../order-dialogs/LaboDetailDialog";
import { LaboPriorOrderWarning } from "../order-dialogs/LaboPriorOrderWarning";
import { priorGroups, type LaboPriorTeeth } from "../order-dialogs/laboPriorTeeth";
import { LaboToothRow } from "../order-dialogs/LaboToothRow";
import { chartOrder } from "./requestSlipModel";
import { SectionBadge } from "./SectionBadge";

interface Props {
  branchId: string;
  /** The order's Mã số or code, for a sent order's view-only chart. */
  code: string;
  teeth: number[];
  editable: boolean;
  priors: LaboPriorTeeth;
  onChange: (teeth: number[]) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/**
 * Chỉ định: the system's "Răng *" row — the purple tooth button opens the
 * Chọn răng chart, the picked teeth follow as chips with their count — then
 * the warning for a tooth another order of the patient is still making (F-91).
 */
export function RequestToothChart({ branchId, code, teeth, editable, priors, onChange, title }: Props) {
  const [viewing, setViewing] = useState<LaboOrderDto | null>(null);
  const shown = chartOrder(teeth).map(String);
  const warnings = editable ? priorGroups(shown, priors) : [];

  return (
    <section className="rs-sec">
      <div className="rs-sech">
        {title ?? t("Labo:Slip:Teeth")} <span className="rs-req">*</span>
        <SectionBadge tone={teeth.length ? "ok" : "miss"}>
          {teeth.length
            ? t("Labo:Slip:TeethCount", String(teeth.length))
            : t("Labo:Slip:NotPicked")}
        </SectionBadge>
      </div>
      <div className="rs-secb rs-teeth">
        <LaboToothRow
          value={shown}
          bridge={false}
          code={code}
          empty="—"
          readOnly={!editable}
          priors={priors}
          onChange={(picked) => onChange(picked.map(Number).sort((a, b) => a - b))}
        />
      </div>
      {warnings.length > 0 && (
        <div className="rs-prior">
          <LaboPriorOrderWarning groups={warnings} onView={setViewing} />
        </div>
      )}
      <LaboDetailDialog
        order={viewing}
        branchId={branchId}
        canCreateAppointment={false}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}
