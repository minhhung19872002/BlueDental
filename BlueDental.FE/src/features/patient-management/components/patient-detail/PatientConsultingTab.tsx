import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  PatientAdviseDto,
  PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { AdviseModal } from "@/features/treatment-management/components/AdviseModal";
import { CreatePlanDialog } from "@/features/treatment-management/components/plan/CreatePlanDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useConsultingActions } from "../../hooks/useConsultingActions";
import { useConsultingData } from "../../hooks/useConsultingData";
import { useDiagnosisEditor } from "../../hooks/useDiagnosisEditor";
import { usePatientImagePermissions } from "../../hooks/usePatientImagePermissions";
import { usePlanVoucher } from "../../hooks/usePlanVoucher";
import type { PatientDto } from "../../types/patient";
import { DiagnosisPrintDialog } from "./consulting/DiagnosisPrintDialog";
import { PatientAdviseCard } from "./PatientAdviseCard";
import { PatientConsultingImagePanel } from "./PatientConsultingImagePanel";
import { PatientDiagnosisCard } from "./PatientDiagnosisCard";
import { PatientDiagnosisForm } from "./PatientDiagnosisForm";
import { QuoteDetailModal } from "./quote/QuoteDetailModal";

/**
 * Chẩn đoán & Tư vấn.
 *
 * Laid out as the reference lays it out: the image panel and the diagnosis card
 * share the top row, the consulting sheet fills the width underneath. Both
 * cards are the app's own table card, so the header stays put, the rows scroll
 * and the pager is pinned to the bottom.
 */
export function PatientConsultingTab({ patient }: { patient: PatientDto }) {
  const patientId = patient.id;
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const data = useConsultingData(patientId, branchId);
  const actions = useConsultingActions(patientId, branchId);
  const permissions = usePatientImagePermissions();

  const [adviseDiagnosis, setAdviseDiagnosis] = useState<PatientDiagnosisDto | null>(null);
  const editor = useDiagnosisEditor(actions, setAdviseDiagnosis);
  const [editingAdvise, setEditingAdvise] = useState<PatientAdviseDto | null>(null);
  const [printing, setPrinting] = useState<PatientDiagnosisDto | null>(null);
  const [selectedAdvises, setSelectedAdvises] = useState<string[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const adviseRows = data.advises.data?.items ?? [];
  const plan = usePlanVoucher(adviseRows, selectedAdvises, branchId);

  // Phiếu tư vấn prints each row's diagnosis note under the diagnosis itself,
  // and the note lives on the slip rather than the advise row.
  const diagnosisNotes = useMemo(
    () =>
      Object.fromEntries(
        (data.diagnoses.data?.items ?? []).map((slip) => [slip.id, slip.note ?? null]),
      ),
    [data.diagnoses.data?.items],
  );
  const branch = useBranchInfo(branchId ?? "").data;

  // Held steady: the print dialog reads these, and a fresh object on every
  // render of this tab would keep resetting the sheet the user is editing.
  const printClinic = useMemo(
    () => ({
      name: branch?.name ?? "",
      address: branch?.address ?? null,
      phone: branch?.phone ?? null,
    }),
    [branch?.name, branch?.address, branch?.phone],
  );
  const printPatient = useMemo(
    () => ({
      code: patient.patientCode,
      name: patient.fullName,
      dateOfBirth: patient.dateOfBirth,
    }),
    [patient.patientCode, patient.fullName, patient.dateOfBirth],
  );

  return (
    <section className="pd-pane pd-consulting">
      <div className="pd-consulting-grid">
        <PatientConsultingImagePanel
          images={data.images}
          branchId={branchId ?? undefined}
          loading={data.imagesLoading}
          uploading={actions.uploading}
          canSort={permissions.canSort}
          onUpload={(files) => void actions.upload(files)}
          onDelete={(image) => void actions.removeImage(image.id)}
          onReorder={(day, from, to) => void actions.reorderImage(day, from, to)}
        />

        <PatientDiagnosisCard
          rows={data.diagnoses.data?.items ?? []}
          totalCount={data.diagnoses.data?.totalCount ?? 0}
          loading={data.diagnoses.isFetching}
          pagination={data.diagnosisPaging}
          expanded={editor.expanded}
          onToggleForm={editor.toggle}
          onEdit={editor.edit}
          onCreateService={setAdviseDiagnosis}
          onPrint={setPrinting}
          onDelete={actions.setRemovingDiagnosis}
        >
          {editor.expanded && (
            <PatientDiagnosisForm
              dentists={data.dentists}
              diagnoses={data.diagnosisOptions}
              submitting={actions.creating || actions.updating}
              editing={editor.editing}
              onSubmit={(submission) => void editor.submit(submission)}
              onClose={editor.close}
            />
          )}
        </PatientDiagnosisCard>
      </div>

      <PatientAdviseCard
        rows={adviseRows}
        totalCount={data.advises.data?.totalCount ?? 0}
        loading={data.advises.isFetching}
        pagination={data.advisePaging}
        plan={plan}
        dentists={data.dentistList}
        diagnosisNotes={diagnosisNotes}
        selected={selectedAdvises}
        onSelect={setSelectedAdvises}
        onOpenAdvise={() => setAdviseDiagnosis(data.diagnoses.data?.items[0] ?? null)}
        onEdit={setEditingAdvise}
        onDelete={actions.setRemovingAdvise}
        onReorder={actions.moveAdvise}
        onAddToPlan={(dentistId) =>
          navigate(
            `?tab=treatment-plan&dentistId=${dentistId}${branchId ? `&branchId=${branchId}` : ""}`,
          )
        }
        onPrint={() => setQuoteOpen(true)}
      />

      <QuoteDetailModal
        open={quoteOpen}
        patientId={patientId}
        branchId={branchId}
        rows={adviseRows.filter((row) => selectedAdvises.includes(row.id))}
        diagnoses={data.diagnoses.data?.items ?? []}
        images={data.images}
        voucherDiscount={plan.discount}
        onClose={() => setQuoteOpen(false)}
      />

      <CreatePlanDialog
        open={Boolean(editingAdvise)}
        patientId={patientId}
        branchId={branchId}
        advise={editingAdvise}
        onClose={() => setEditingAdvise(null)}
      />

      <AdviseModal
        open={Boolean(adviseDiagnosis)}
        patientId={patientId}
        diagnosis={adviseDiagnosis}
        onClose={() => setAdviseDiagnosis(null)}
        onCreated={() => void data.advises.refetch()}
      />

      <DiagnosisPrintDialog
        diagnosis={printing}
        clinic={printClinic}
        patient={printPatient}
        images={data.images}
        onClose={() => setPrinting(null)}
      />

      <ConfirmDeleteDialog
        open={Boolean(actions.removingDiagnosis)}
        noun={t("chẩn đoán")}
        name={actions.removingDiagnosis?.code ?? ""}
        pending={actions.cancellingDiagnosis}
        onConfirm={() => void actions.confirmCancelDiagnosis()}
        onClose={() => actions.setRemovingDiagnosis(null)}
      />

      <ConfirmDeleteDialog
        open={Boolean(actions.removingAdvise)}
        noun={t("dịch vụ tư vấn")}
        name={actions.removingAdvise?.serviceName ?? ""}
        pending={actions.rejectingAdvise}
        onConfirm={() => void actions.confirmRejectAdvise()}
        onClose={() => actions.setRemovingAdvise(null)}
      />
    </section>
  );
}
