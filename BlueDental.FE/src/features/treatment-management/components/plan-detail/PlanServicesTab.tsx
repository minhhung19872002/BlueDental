import { createContext, useContext, useMemo, useState, type HTMLAttributes } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { CreatePaymentDialog } from "@/features/patient-management/components/patient-detail/CreatePaymentDialog";
import { GENDER, type GenderCode, type PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useDragReorder, type DragReorder } from "@/hooks/useDragReorder";
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
  useReorderServiceLine,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { PrescriptionDialog } from "../PrescriptionDialog";
import { CancelServiceDialog } from "./CancelServiceDialog";
import { DeleteServiceDialog } from "./DeleteServiceDialog";
import { ConvertServiceDialog } from "./convert/ConvertServiceDialog";
import { CreatePlanDialog } from "../plan/CreatePlanDialog";
import { EMPTY_TOOTH_VALUE } from "../plan/toothPicker";
import { ToothPickerDialog } from "../plan/ToothPickerDialog";
import { PlanServicesToolbar } from "./PlanServicesToolbar";
import { PlanSlipDialog } from "./PlanSlipDialog";
import { ServiceCardList } from "./ServiceCardList";
import { ServiceDetailDialog } from "./ServiceDetailDialog";
import type { ServiceAction } from "./ServiceStatusPill";
import { buildServiceColumns, type ServiceDragHandle, type ServiceRowActions } from "./serviceColumns";
import { planDetailRows, type PlanDetailRow } from "./planDetailTypes";
import { isLineEditable, useEditServiceRow } from "./useEditServiceRow";

const NARROW_SCREEN = "(max-width: 640px)";

/**
 * The drag state has to reach the row element antd builds, and antd gives no
 * way to pass props into it — hence a context rather than a closure.
 */
const DragContext = createContext<DragReorder<PlanDetailRow> | null>(null);

/**
 * One table row, wired for dragging. antd hands the row its key through
 * `data-row-key`, which is how a row it constructed finds its own drag state.
 */
function DraggableRow({ children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  const drag = useContext(DragContext);
  const key = (rest as { "data-row-key"?: string })["data-row-key"];

  if (!drag || !key) {
    return <tr {...rest}>{children}</tr>;
  }

  return (
    <tr
      {...rest}
      ref={drag.registerRow(key)}
      className={[rest.className, drag.draggingKey === key && "pdt-row--dragging"]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </tr>
  );
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
 * Tab "Chi tiết": the toolbar, the fifteen-column service table (cards on
 * phones) and the dialogs the rows open. Line rows come from the slip; the
 * diagnosis columns are filled from the advise each line was written from.
 * "Thêm dịch vụ phát sinh" opens "Tạo phiếu dịch vụ", which adds its line to
 * this slip (owner 2026-10-15; it replaced the inline new row).
 */
export function PlanServicesTab({ patient, plan, branchId }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  // Adding, completing, converting, cancelling and reordering a line are all
  // one endpoint family on the server, guarded by treatmentConsultation.update.
  const consultation = useAbility("treatmentConsultation");
  const canEditLines = consultation.canUpdate;
  const paymentAbility = useAbility("payment");
  const pagination = useTablePagination(10);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: 200 });
  const clinic = useBranchInfo(branchId);
  const complete = useCompleteServiceLine();
  const cancel = useCancelServiceLine();
  const reorder = useReorderServiceLine();
  const edit = useEditServiceRow(plan.id);

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

  /**
   * Saves a drop. `to` counts within the page being looked at, while the slip
   * numbers its lines from one — hence the page offset.
   */
  const moveLine = async (lineId: string, sortOrder: number) => {
    try {
      await reorder.mutateAsync({ planId: plan.id, serviceLineId: lineId, sortOrder });
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const drag = useDragReorder<PlanDetailRow>({
    items: pageRows,
    getKey: (row) => row.service.id,
    enabled: !narrow,
    onCommit: (from, to) => moveLine(pageRows[from].service.id, pagination.skipCount + to + 1),
  });

  // The line being edited carries its inline inputs; the rest render as saved.
  const lineRows: PlanDetailRow[] = edit.controller
    ? drag.items.map((row) =>
        row.service.id === edit.editingId ? { ...row, edit: edit.controller ?? undefined } : row,
      )
    : drag.items;
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

  // One inline edit at a time: the pencil goes while another line is open.
  const rowBusy = edit.controller !== null;
  const actions = useMemo<ServiceRowActions>(
    () => ({
      onView: setViewing,
      onStatus: canEditLines ? handleStatus : undefined,
      onEdit: canEditLines && !rowBusy ? edit.start : undefined,
      canEditLine: (row) => isLineEditable(row.service),
      // "Xóa" is the consulting chain's delete right, as on the server (R-953).
      onDelete: consultation.canDelete && !rowBusy ? setDeleting : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over stable mutations
    [plan.id, canEditLines, consultation.canDelete, rowBusy],
  );
  const dragHandle = useMemo<ServiceDragHandle>(
    () => ({
      enabled: !narrow && canEditLines,
      handleProps: drag.handleProps,
      // `row.index` is the line's position on the whole slip, so a keyboard
      // nudge needs no page arithmetic; the server clamps the ends.
      onNudge: (row, delta) => void moveLine(row.service.id, row.index + delta),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moveLine closes over stable mutations
    [narrow, canEditLines, drag.handleProps],
  );
  const columns = useMemo(() => buildServiceColumns(actions, dragHandle), [actions, dragHandle]);

  return (
    <div className="pdt-pane">
      <PlanServicesToolbar
        canAddService={
          canEditLines &&
          plan.status !== PLAN_STATUS.Completed &&
          plan.status !== PLAN_STATUS.Cancelled
        }
        onAddService={() => {
          edit.stop();
          setAddOpen(true);
        }}
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
        <DragContext.Provider value={drag}>
          <div className="bd-cat-card tp-table pdt-table">
            <DataTable<PlanDetailRow>
              rowKey={(row) => row.service.id}
              components={{ body: { row: DraggableRow } }}
              columns={columns}
              dataSource={lineRows}
              pagination={pagination.buildConfig(rows.length, showTotal)}
              locale={{ emptyText: t("Treatment:Common:NoData") }}
            />
          </div>
        </DragContext.Provider>
      )}

      <ToothPickerDialog
        open={edit.teethOpen}
        value={edit.controller?.values.teeth ?? EMPTY_TOOTH_VALUE}
        lockedTeeth={edit.stagedTeeth}
        onConfirm={edit.confirmTeeth}
        onClose={edit.closeTeeth}
      />
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
