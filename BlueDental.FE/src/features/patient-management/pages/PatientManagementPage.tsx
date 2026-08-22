import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientListView } from "../components/PatientListView";
import { PatientEditorModal } from "../components/PatientEditorModal";
import { usePatient } from "../api/patientQueries";
import type { PatientListItem } from "../types/patient";

function EditPatientModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data: patient, isLoading } = usePatient(patientId);
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
