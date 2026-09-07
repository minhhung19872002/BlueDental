import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { TreatmentStageDialog } from "@/features/patient-management/components/patient-detail/TreatmentStageDialog";
import { GENDER, type GenderCode, type PatientDto } from "@/features/patient-management/types/patient";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  useCancelServiceLine,
  useCompleteServiceLine,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { InvoiceModal } from "../InvoiceModal";
import { PrescriptionDialog } from "../PrescriptionDialog";
import { CancelServiceDialog } from "./CancelServiceDialog";
import { EMPTY_TOOTH_VALUE } from "../plan/toothPicker";
import { ToothPickerDialog } from "../plan/ToothPickerDialog";
import { PlanServicesToolbar } from "./PlanServicesToolbar";
import { PlanSlipDialog } from "./PlanSlipDialog";
import { ServiceCardList } from "./ServiceCardList";
import { ServiceDetailDialog } from "./ServiceDetailDialog";
import type { ServiceAction } from "./ServiceStatusPill";
import { buildServiceColumns, type ServiceRowActions } from "./serviceColumns";
import {
  DRAFT_ROW_KEY,
  isDraftRow,
  planDetailRows,
  type PlanDetailRow,
  type ServiceTableRow,
} from "./planDetailTypes";
import { useDraftServiceRow } from "./useDraftServiceRow";

const NARROW_SCREEN = "(max-width: 640px)";

const GENDER_LABELS: Record<GenderCode, string> = {
  [GENDER.Male]: "Nam",
  [GENDER.Female]: "Nữ",
  [GENDER.Other]: "Khác",
  [GENDER.PreferNotToSay]: "Không tiết lộ",
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
 * Tab "Chi tiết": the toolbar, the fifteen-column service table (cards on
 * phones) and the dialogs the rows open. Line rows come from the slip; the
 * diagnosis columns are filled from the advise each line was written from.
 * Picking a service in the toolbar puts the inline new row on top of them.
 */
export function PlanServicesTab({ patient, plan, branchId }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  const pagination = useTablePagination(10);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: 200 });
  const clinic = useBranchInfo(branchId);
  const complete = useCompleteServiceLine();
  const cancel = useCancelServiceLine();
  const draft = useDraftServiceRow(plan.id);

  const [viewing, setViewing] = useState<PlanDetailRow | null>(null);
  const [cancelling, setCancelling] = useState<PlanDetailRow | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);

  const rows = useMemo(() => planDetailRows(plan, advises.data?.items ?? []), [plan, advises.data]);
  const pageRows = rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  // The new row sits on top of the table on the reference.
  const tableRows: ServiceTableRow[] = draft.controller
    ? [{ kind: "draft", draft: draft.controller }, ...pageRows]
    : pageRows;
  const showTotal = countedTotal(t("dịch vụ"));

  const handleStatus = async (row: PlanDetailRow, action: ServiceAction) => {
    if (action === "cancel") {
      setCancelling(row);
      return;
    }
    if (action === "convert") {
      toast.info(t("Chức năng đang phát triển"));
      return;
    }
    try {
      await complete.mutateAsync({ planId: plan.id, lineId: row.service.id });
      toast.success(t("Đã hoàn thành dịch vụ"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelling) return;
    try {
      await cancel.mutateAsync({ planId: plan.id, lineId: cancelling.service.id });
      toast.success(t("Đã hủy dịch vụ"));
      setCancelling(null);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const actions = useMemo<ServiceRowActions>(
    () => ({ onView: setViewing, onStatus: handleStatus }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over stable mutations
    [plan.id],
  );
  const columns = useMemo(() => buildServiceColumns(actions), [actions]);

  return (
    <div className="pdt-pane">
      <PlanServicesToolbar
        draftServiceId={draft.controller?.service.id ?? null}
        onPickService={draft.start}
        onAddStage={() => setStageOpen(true)}
        onPrescription={() => setPrescriptionOpen(true)}
        onInvoice={() => setInvoiceOpen(true)}
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
          <DataTable<ServiceTableRow>
            rowKey={(row) => (isDraftRow(row) ? DRAFT_ROW_KEY : row.service.id)}
            rowClassName={(row) => (isDraftRow(row) ? "pdt-row--draft" : "")}
            columns={columns}
            dataSource={tableRows}
            pagination={pagination.buildConfig(rows.length, showTotal)}
            locale={{ emptyText: t("Không có dữ liệu") }}
          />
        </div>
      )}

      <ToothPickerDialog
        open={draft.teethOpen}
        value={draft.controller?.values.teeth ?? EMPTY_TOOTH_VALUE}
        onConfirm={draft.confirmTeeth}
        onClose={draft.closeTeeth}
      />
      <ConfirmDeleteDialog
        open={draft.discardOpen}
        noun={t("dịch vụ")}
        title={t("Xác nhận xóa")}
        question={t("Sau khi xác nhận, thông tin sẽ bị xóa và không thể khôi phục.")}
        onConfirm={draft.confirmDiscard}
        onClose={draft.closeDiscard}
      />
      <ServiceDetailDialog row={viewing} patient={patient} onClose={() => setViewing(null)} />
      <CancelServiceDialog
        service={cancelling?.service ?? null}
        saving={cancel.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelling(null)}
      />
      <TreatmentStageDialog
        open={stageOpen}
        patientId={patient.id}
        patientCode={patient.patientCode}
        patientName={patient.fullName}
        branchId={branchId}
        plan={plan}
        focusServiceId={null}
        onClose={() => setStageOpen(false)}
        onOpenPlan={() => setStageOpen(false)}
      />
      <PrescriptionDialog
        open={prescriptionOpen}
        patient={prescriptionPatient(patient)}
        prescription={null}
        onClose={() => setPrescriptionOpen(false)}
      />
      {invoiceOpen && <InvoiceModal open patient={patient} plan={plan} onClose={() => setInvoiceOpen(false)} />}
      <PlanSlipDialog open={slipOpen} patient={patient} plan={plan} clinic={clinic.data} onClose={() => setSlipOpen(false)} />
    </div>
  );
}
