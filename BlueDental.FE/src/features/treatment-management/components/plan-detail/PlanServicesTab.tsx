import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { CreatePaymentDialog } from "@/features/patient-management/components/patient-detail/CreatePaymentDialog";
import { GENDER, type GenderCode, type PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  PLAN_STATUS,
  useCancelServiceLine,
  useCompleteServiceLine,
  usePatientAccount,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { PrescriptionDialog } from "../PrescriptionDialog";
import { CancelServiceDialog } from "./CancelServiceDialog";
import { DeleteServiceDialog } from "./DeleteServiceDialog";
import { ConvertServiceDialog } from "./convert/ConvertServiceDialog";
import { CreatePlanDialog } from "../plan/CreatePlanDialog";
import { PlanServicesToolbar } from "./PlanServicesToolbar";
import { PlanSlipDialog } from "./PlanSlipDialog";
import { PlanStageSection } from "./PlanStageSection";
import { ServiceCardList } from "./ServiceCardList";
import { ServiceDetailDialog } from "./ServiceDetailDialog";
import type { ServiceAction } from "./ServiceStatusMenu";
import { buildServiceColumns, type ServiceRowActions } from "./serviceColumns";
import { planDetailRows, type PlanDetailRow } from "./planDetailTypes";

const NARROW_SCREEN = "(max-width: 640px)";

/**
 * A click on a row picks it for the công đoạn below — but not one that landed
 * on a control inside it, nor one from a menu antd portals out of the row.
 */
function isRowPick(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): boolean {
  if (!(event.target instanceof Element)) return false;
  if (!event.currentTarget.contains(event.target)) return false;
  return event.target.closest("button, a, input, [role='menu']") === null;
}

const GENDER_LABELS: Record<GenderCode, string> = {
  [GENDER.Male]: "Common:Gender:Male",
  [GENDER.Female]: "Common:Gender:Female",
  [GENDER.Other]: "Common:Gender:Other",
  [GENDER.PreferNotToSay]: "Common:Gender:PreferNotToSay",
};

function prescriptionPatient(patient: PatientDto): PrescriptionPatientSummary {
  return {
    id: patient.id,
    code: patient.patientCode,
    fullName: patient.fullName,
    genderLabel: t(GENDER_LABELS[patient.gender]),
    dateOfBirth: patient.dateOfBirth,
    phoneNumber: patient.phoneNumber,
    diseaseHistoryEntryIds: patient.diseaseHistoryEntryIds,
  };
}

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
}

/**
 * Tab "Chi tiết": the toolbar, the service table (cards on phones), and under
 * it "Chi tiết phiếu" with Lịch sử điều trị, laid open on the page instead of
 * the patient record's dialog (BA 2026-10-15). Picking a row narrows that panel
 * to the line; picking it again shows every line. Line rows come from the
 * slip; Chẩn đoán falls back to the advise each line was written from.
 * "Thêm dịch vụ phát sinh" opens "Tạo phiếu dịch vụ", which adds its line to
 * this slip (owner 2026-10-15; it replaced the inline new row).
 */
/** Placeholder for "Chỉnh sửa" until its modal lands. */
function openEditModal(): void {}

export function PlanServicesTab({ patient, plan, branchId }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  // Adding, completing, converting and cancelling a line are all
  // one endpoint family on the server, guarded by treatmentConsultation.update.
  const consultation = useAbility("treatmentConsultation");
  const canEditLines = consultation.canUpdate;
  const paymentAbility = useAbility("payment");
  const canReadStages = useAbility("treatmentStage").canRead;
  const pagination = useTablePagination(10);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: 200 });
  const clinic = useBranchInfo(branchId);
  const complete = useCompleteServiceLine();
  const cancel = useCancelServiceLine();

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PlanDetailRow | null>(null);
  const [cancelling, setCancelling] = useState<PlanDetailRow | null>(null);
  const [deleting, setDeleting] = useState<PlanDetailRow | null>(null);
  const [converting, setConverting] = useState<PlanDetailRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  // Dư nợ for the payment dialog; the server keeps it behind payment.read.
  const account = usePatientAccount(patient.id, branchId, payOpen && paymentAbility.canRead);
  const [slipOpen, setSlipOpen] = useState(false);

  const rows = useMemo(() => planDetailRows(plan, advises.data?.items ?? []), [plan, advises.data]);
  const pageRows = rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);

  // A line taken off the slip can no longer be the one picked.
  const selectedId = rows.some((row) => row.service.id === pickedId) ? pickedId : null;
  const showTotal = countedTotal(t("Treatment:Service:ServiceNoun"));

  const handleStatus = async (row: PlanDetailRow, action: ServiceAction) => {
    if (action === "cancel") {
      setCancelling(row);
      return;
    }
    if (action === "convert") {
      setConverting(row);
      return;
    }
    try {
      await complete.mutateAsync({ planId: plan.id, lineId: row.service.id });
      toast.success(t("Treatment:Service:CompleteSuccess"));
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelling) return;
    try {
      await cancel.mutateAsync({ planId: plan.id, lineId: cancelling.service.id });
      toast.success(t("Treatment:Service:CancelSuccess"));
      setCancelling(null);
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const actions = useMemo<ServiceRowActions>(
    () => ({
      onView: setViewing,
      onStatus: canEditLines ? handleStatus : undefined,
      // The pencil stays where it was; its edit modal is a later task (owner 2026-10-15).
      onEdit: canEditLines ? openEditModal : undefined,
      // "Xóa" is the consulting chain's delete right, as on the server (R-953).
      onDelete: consultation.canDelete ? setDeleting : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over stable mutations
    [plan.id, canEditLines, consultation.canDelete],
  );
  const columns = useMemo(() => buildServiceColumns(actions), [actions]);

  const pickRow = (row: PlanDetailRow) =>
    setPickedId((current) => (current === row.service.id ? null : row.service.id));

  return (
    <div className="pdt-pane">
      <PlanServicesToolbar
        canAddService={
          canEditLines &&
          plan.status !== PLAN_STATUS.Completed &&
          plan.status !== PLAN_STATUS.Cancelled
        }
        onAddService={() => setAddOpen(true)}
        onPrescription={() => setPrescriptionOpen(true)}
        onInvoice={() => setPayOpen(true)}
        onPrint={() => setSlipOpen(true)}
      />

      {narrow ? (
        <ServiceCardList
          rows={pageRows}
          total={rows.length}
          pagination={pagination}
          actions={actions}
          showTotal={showTotal}
        />
      ) : (
        <div className="bd-cat-card tp-table pdt-table">
          <DataTable<PlanDetailRow>
            rowKey={(row) => row.service.id}
            columns={columns}
            dataSource={pageRows}
            pagination={pagination.buildConfig(rows.length, showTotal)}
            locale={{ emptyText: t("Treatment:Common:NoData") }}
            rowClassName={(row) => (row.service.id === selectedId ? "pdt-row--picked" : "pdt-row--pickable")}
            onRow={(row) => ({
              tabIndex: 0,
              "aria-selected": row.service.id === selectedId,
              onClick: (event) => {
                if (isRowPick(event)) pickRow(row);
              },
              onKeyDown: (event) => {
                if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                  event.preventDefault();
                  pickRow(row);
                }
              },
            })}
          />
        </div>
      )}

      {canReadStages && (
        <PlanStageSection
          patient={patient}
          plan={plan}
          branchId={branchId}
          serviceId={selectedId}
        />
      )}

      <ServiceDetailDialog row={viewing} patient={patient} onClose={() => setViewing(null)} />
      <ConvertServiceDialog row={converting} onClose={() => setConverting(null)} />
      <CancelServiceDialog
        service={cancelling?.service ?? null}
        saving={cancel.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelling(null)}
      />
      <DeleteServiceDialog planId={plan.id} service={deleting?.service ?? null} onClose={() => setDeleting(null)} />
      <CreatePlanDialog
        open={addOpen}
        patientId={patient.id}
        branchId={branchId}
        planId={plan.id}
        onClose={() => setAddOpen(false)}
      />
      <PrescriptionDialog
        open={prescriptionOpen}
        patient={prescriptionPatient(patient)}
        prescription={null}
        onClose={() => setPrescriptionOpen(false)}
      />
      <CreatePaymentDialog
        open={payOpen}
        patientId={patient.id}
        branchId={branchId}
        plan={plan}
        focusServiceId={null}
        heldForPatient={account.data?.heldForPatient ?? 0}
        onClose={() => setPayOpen(false)}
        onSaved={() => setPayOpen(false)}
      />
      <PlanSlipDialog open={slipOpen} patient={patient} plan={plan} clinic={clinic.data} onClose={() => setSlipOpen(false)} />
    </div>
  );
}
