import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { t } from "@/lib/i18n";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
}

/**
 * The round back arrow and the three-step breadcrumb the reference draws
 * above the slip: [code] - name › Kế hoạch điều trị › slip code.
 */
export function PlanDetailHeader({ patient, plan, branchId }: Props) {
  const navigate = useNavigate();
  const branch = branchId ? `&branchId=${encodeURIComponent(branchId)}` : "";
  const patientPath = `/patient/${patient.id}?tab=profile${branch}`;
  const plansPath = `/patient/${patient.id}?tab=treatment-plan${branch}`;

  return (
    <div className="pdt-header">
      <button
        type="button"
        className="pdt-back"
        aria-label={t("Quay lại")}
        onClick={() => navigate(plansPath)}
      >
        <ArrowLeft size={16} aria-hidden="true" />
      </button>
      <nav className="pdt-crumbs" aria-label={t("Đường dẫn")}>
        <Link className="pdt-crumb pdt-crumb--strong" to={patientPath}>
          [{patient.patientCode}] - {patient.fullName}
        </Link>
        <span className="pdt-crumb-sep" aria-hidden="true">
          &gt;
        </span>
        <Link className="pdt-crumb" to={plansPath}>
          {t("Kế hoạch điều trị")}
        </Link>
        <span className="pdt-crumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span className="pdt-crumb pdt-crumb--strong pdt-crumb--current" aria-current="page">
          {plan.code}
        </span>
      </nav>
    </div>
  );
}
