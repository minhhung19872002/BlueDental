import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useDeletePatientImage, type PatientImageType } from "../../../api/patientImageApi";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { ezdentLinkOf, useXrayStationAvailable } from "../../../api/xrayStationApi";
import { useCameraAvailability } from "../../../hooks/useCameraAvailability";
import { usePatientImagePermissions } from "../../../hooks/usePatientImagePermissions";
import { PatientImageStageColumn } from "./PatientImageStageColumn";
import { PatientImageToolbar } from "./PatientImageToolbar";
import { PATIENT_IMAGE_STAGES } from "./patientImageStages";

interface Props {
  patientId: string;
  /** Mã khách hàng — what "Mở EzDent-i" hands the X-ray PC (F-95). */
  patientCode: string;
}

/**
 * Tab "Hình ảnh" of the patient record: the note search and stage filter,
 * then one column per "Giai đoạn điều trị" — Trước, Trong, Sau — each with its
 * own day-by-day tiles, upload and viewer. Picking a stage leaves only its
 * column, full width; a search narrows every column to the matching notes.
 * See docs/clone/pages/patient-detail.md, Tab 5.
 */
export function PatientImageTab({ patientId, patientCode }: Props) {
  const permissions = usePatientImagePermissions();
  const xrayStation = useXrayStationAvailable(useCurrentBranchId());
  const deleteImage = useDeletePatientImage();
  const cameraAvailability = useCameraAvailability();

  // In state, not the URL, as the reference keeps it; the tab opens on all.
  const [filter, setFilter] = useState<PatientImageType | null>(null);
  const [search, setSearch] = useState("");
  // Asked of the server once typing pauses, not on every key.
  const settledSearch = useDebounce(search.trim(), 300);
  const [removing, setRemoving] = useState<PatientImageViewModel | null>(null);

  const stages = filter === null ? PATIENT_IMAGE_STAGES : PATIENT_IMAGE_STAGES.filter((s) => s.type === filter);

  const handleDelete = async () => {
    if (!removing) return;
    try {
      await deleteImage.mutateAsync(removing.id);
      toast.success(t("Patient:Image:DeleteSuccess"));
      setRemoving(null);
    } catch {
      toast.error(t("Patient:Image:DeleteError"));
    }
  };

  // The agent on the X-ray PC answers the link; on any other PC it does nothing.
  const handleOpenEzdent = () => {
    window.location.href = ezdentLinkOf(patientCode);
  };

  return (
    <div className="pi-tab" data-testid="patient-image-tab">
      <PatientImageToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        onClearFilter={() => setFilter(null)}
        onOpenEzdent={xrayStation.data && patientCode ? handleOpenEzdent : undefined}
      />

      <div className={["pi-stages", filter !== null && "pi-stages--single"].filter(Boolean).join(" ")}>
        {stages.map((stage) => (
          <PatientImageStageColumn
            key={stage.type}
            patientId={patientId}
            stage={stage}
            search={settledSearch}
            permissions={permissions}
            cameraAvailability={cameraAvailability}
            deleting={deleteImage.isPending}
            onDelete={setRemoving}
          />
        ))}
      </div>

      <ConfirmDeleteDialog
        open={removing !== null}
        noun={t("Patient:Image:Noun")}
        title={t("Patient:Image:DeleteTitle")}
        question={t("Patient:Image:DeleteQuestion")}
        pending={deleteImage.isPending}
        onConfirm={handleDelete}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
