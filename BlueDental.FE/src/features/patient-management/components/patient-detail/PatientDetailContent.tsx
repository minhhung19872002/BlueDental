import type { PatientDto } from "../../types/patient";
import { PatientImagePanel } from "../PatientImagePanel";
import { TreatmentPlanPanel } from "@/features/treatment-management/components/TreatmentPlanPanel";
import { PatientAppointmentTab } from "./PatientAppointmentTab";
import { PatientConsultingTab } from "./PatientConsultingTab";
import { PatientDebtTab } from "./PatientDebtTab";
import { PatientProfileTab } from "./PatientProfileTab";
import {
  PatientCareTab,
  PatientInvoiceTab,
  PatientLaboTab,
  PatientPrescriptionTab,
} from "./PatientRecordTabs";

interface Props {
  activeTab: string;
  patient: PatientDto;
}

export function PatientDetailContent({ activeTab, patient }: Props) {
  const id = patient.id;
  switch (activeTab) {
    case "consulting":
      return <PatientConsultingTab patientId={id} />;
    case "treatment-plan":
      return (
        <section className="pd-pane pd-pane--fill">
          <TreatmentPlanPanel patientId={id} />
        </section>
      );
    case "appointment":
      return <PatientAppointmentTab patientId={id} />;
    case "image":
      return (
        <section className="pd-pane pd-pane--fill">
          <PatientImagePanel patientId={id} />
        </section>
      );
    case "labo":
      return <PatientLaboTab patient={patient} />;
    case "prescription":
      return <PatientPrescriptionTab patient={patient} />;
    case "care":
      return <PatientCareTab patient={patient} />;
    case "invoice":
      return <PatientInvoiceTab patientId={id} />;
    case "debt-history":
      return <PatientDebtTab patientId={id} />;
    default:
      return <PatientProfileTab patient={patient} />;
  }
}
