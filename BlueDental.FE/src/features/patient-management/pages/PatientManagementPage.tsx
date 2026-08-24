import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientListView } from "../components/PatientListView";
import { PatientEditorModal } from "../components/PatientEditorModal";
import { usePatientDto } from "../api/patientQueries";
import type { PatientListItem } from "../types/patient";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";

function EditPatientModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data: patient, isLoading } = usePatientDto(patientId);
  if (isLoading || !patient) return null;
  return (
    <PatientEditorModal
      open
      patient={patient}
      onClose={onClose}
      onSuccess={onClose}
    />
  );
}

export function PatientManagementPage() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleRowClick = (patient: PatientListItem) => {
    navigate(`/patient/${patient.id}`);
  };

  return (
    <>
      <PageHeader
        title={t("Danh sách bệnh nhân")}
        subtitle={t("Hồ sơ khách hàng của phòng khám")}
      />

      <PatientListView
        onAdd={() => setAddOpen(true)}
        onRowClick={handleRowClick}
        onEdit={(id) => setEditingId(id)}
      />

      <PatientEditorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />

      {editingId && (
        <EditPatientModal
          patientId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}
