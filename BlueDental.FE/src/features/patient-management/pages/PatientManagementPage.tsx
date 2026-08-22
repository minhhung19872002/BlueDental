import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientListView } from "../components/PatientListView";
import { PatientEditorModal } from "../components/PatientEditorModal";
import type { PatientListItem } from "../types/patient";

export function PatientManagementPage() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const handleRowClick = (patient: PatientListItem) => {
    navigate(`/patient/${patient.id}`);
  };

  return (
    <>
      <PatientListView
        onAdd={() => setAddOpen(true)}
        onRowClick={handleRowClick}
      />

      <PatientEditorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => setAddOpen(false)}
      />
    </>
  );
}
