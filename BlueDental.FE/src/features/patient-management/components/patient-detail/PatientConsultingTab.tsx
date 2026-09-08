import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PatientDiagnosisDto } from "@/features/treatment-management/api/consultingApi";
import { AdviseModal } from "@/features/treatment-management/components/AdviseModal";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useConsultingActions } from "../../hooks/useConsultingActions";
import { useConsultingData } from "../../hooks/useConsultingData";
import { usePatientImagePermissions } from "../../hooks/usePatientImagePermissions";
import { usePlanVoucher } from "../../hooks/usePlanVoucher";
import { PatientAdviseCard } from "./PatientAdviseCard";
import { PatientConsultingImagePanel } from "./PatientConsultingImagePanel";
import { PatientDiagnosisCard } from "./PatientDiagnosisCard";
import { PatientDiagnosisForm, type DiagnosisSubmission } from "./PatientDiagnosisForm";
import { QuoteDetailModal } from "./quote/QuoteDetailModal";

/**
 * Chẩn đoán & Tư vấn.
 *
 * Laid out as the reference lays it out: the image panel and the diagnosis card
 * share the top row, the consulting sheet fills the width underneath. Both
 * cards are the app's own table card, so the header stays put, the rows scroll
 * and the pager is pinned to the bottom.
 */
export function PatientConsultingTab({ patientId }: { patientId: string }) {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const data = useConsultingData(patientId, branchId);
  const actions = useConsultingActions(patientId, branchId);
  const permissions = usePatientImagePermissions();

  const [expanded, setExpanded] = useState(false);
  const [adviseDiagnosis, setAdviseDiagnosis] = useState<PatientDiagnosisDto | null>(null);
  const [scheduling, setScheduling] = useState<PatientDiagnosisDto | null>(null);
  const [selectedAdvises, setSelectedAdvises] = useState<string[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const adviseRows = data.advises.data?.items ?? [];
  const plan = usePlanVoucher(adviseRows, selectedAdvises, branchId);

  /** "Lưu Chẩn Đoán" files the slip; "Tạo dịch vụ" files it and opens the advise. */
  const handleSubmitDiagnosis = async ({ intent, ...input }: DiagnosisSubmission) => {
    const created = await actions.create(input);
    if (!created) return;
    setExpanded(false);
    if (intent === "service") setAdviseDiagnosis(created);
  };

  return (
    <section className="pd-pane pd-consulting">
      <div className="pd-consulting-grid">
        <PatientConsultingImagePanel
          images={data.images}
          catalog={data.consultingData}
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
          expanded={expanded}
          onToggleForm={() => setExpanded((value) => !value)}
          onCreateService={setAdviseDiagnosis}
          onSchedule={setScheduling}
          onDelete={actions.setRemovingDiagnosis}
        >
          {expanded && (
            <PatientDiagnosisForm
              dentists={data.dentists}
              diagnoses={data.diagnosisOptions}
              submitting={actions.creating}
              onSubmit={(submission) => void handleSubmitDiagnosis(submission)}
              onClose={() => setExpanded(false)}
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
        selected={selectedAdvises}
        onSelect={setSelectedAdvises}
        onOpenAdvise={() => setAdviseDiagnosis(data.diagnoses.data?.items[0] ?? null)}
        onDelete={actions.setRemovingAdvise}
        onAddToPlan={() =>
          navigate(`?tab=treatment-plan${branchId ? `&branchId=${branchId}` : ""}`)
        }
        onQuote={() => window.print()}
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

      <AdviseModal
        open={Boolean(adviseDiagnosis)}
        patientId={patientId}
        diagnosis={adviseDiagnosis}
        onClose={() => setAdviseDiagnosis(null)}
        onCreated={() => void data.advises.refetch()}
      />

      <AppointmentEditorModal
        open={Boolean(scheduling)}
        initialPatientId={patientId}
        initialReason={scheduling?.diagnosisName ?? undefined}
        lockPatient
        onClose={() => setScheduling(null)}
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
