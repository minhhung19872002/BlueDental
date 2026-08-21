import { useState } from "react";
import { PatientListView } from "../components/PatientListView";
import { PatientEditorModal } from "../components/PatientEditorModal";
import { PatientDetailDrawer } from "../components/PatientDetailDrawer";
import type { PatientListItem } from "../types/patient";

export function PatientManagementPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <PatientListView
        onAdd={() => setAddOpen(true)}
        onRowClick={(patient: PatientListItem) => setSelectedId(patient.id)}
      />

      <PatientEditorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />

      <PatientDetailDrawer
        patientId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
