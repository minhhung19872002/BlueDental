import { useMemo, useState } from "react";
import { DollarSign, Printer } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { CreatePaymentDialog } from "@/features/patient-management/components/patient-detail/CreatePaymentDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { countedTotal } from "@/utils/countedTotal";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  downloadEInvoicePdf,
  isReceiptInvoiceable,
  usePlanEInvoices,
  useSyncEInvoice,
  type ElectronicInvoiceDto,
} from "../../api/eInvoiceApi";
import {
  PAYMENT_KIND,
  useDeletePayment,
  usePatientAccount,
  usePatientPayments,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { InvoiceModal } from "../InvoiceModal";
import { EInvoiceBadge } from "./EInvoiceBadge";
import { PaymentCardList } from "./PaymentCardList";
import { PaymentEditDialog } from "./PaymentEditDialog";
import { PaymentReceiptDialog } from "./PaymentReceiptDialog";
import { buildPaymentColumns, paymentCardRows } from "./paymentColumns";
import { aggregateReceiptOf, receiptOf, type ReceiptView } from "./receiptView";

const NARROW_SCREEN = "(max-width: 640px)";
const PAGE_CAP = 200;

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
}

/**
 * Tab "Thanh toán": every receipt filed against this slip, newest first, with
 * "Tạo Phiếu Thanh Toán" and "In hóa đơn tổng" above the table.
 */
export function PlanPaymentsTab({ patient, plan, branchId }: Props) {
  const { canCreate, canUpdate, canDelete } = useAbility("payment");
  const narrow = useMediaQuery(NARROW_SCREEN);
  const pagination = useTablePagination(20);
  const query = usePatientPayments({
    patientId: patient.id,
    clinicBranchId: branchId,
    treatmentPlanId: plan.id,
    kind: PAYMENT_KIND.Payment,
    maxResultCount: PAGE_CAP,
  });
  const account = usePatientAccount(patient.id, branchId);
  const clinic = useBranchInfo(branchId);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: PAGE_CAP });

  const [creating, setCreating] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [editing, setEditing] = useState<PatientPaymentDto | null>(null);
  const [cancelling, setCancelling] = useState<PatientPaymentDto | null>(null);
  const remove = useDeletePayment();

  // ── E-invoice ───────────────────────────────────────────────────────────
  const canFinalize = useAbility("payment").can("finalize");
  const eInvoiceQuery = usePlanEInvoices({ treatmentPlanId: plan.id, clinicBranchId: branchId });
  const sync = useSyncEInvoice();
  const [invoicing, setInvoicing] = useState<PatientPaymentDto | null>(null);

  const eInvoiceOf = (paymentId: string): ElectronicInvoiceDto | undefined =>
    eInvoiceQuery.data?.find((inv) => inv.patientPaymentId === paymentId);
  const canIssueInvoice = (payment: PatientPaymentDto) => isReceiptInvoiceable(payment.id, eInvoiceQuery.data);

  const handleSync = (invoice: ElectronicInvoiceDto) =>
    sync.mutate(invoice.id, { onSuccess: () => toast.success(t("Treatment:EInvoice:Synced")) });

  const handleDownload = (invoice: ElectronicInvoiceDto) => {
    downloadEInvoicePdf(invoice).catch((error: unknown) =>
      notifyError(extractApiError(error) || t("Treatment:EInvoice:DownloadError")),
    );
  };

  const renderEInvoice = (payment: PatientPaymentDto) => {
    const invoice = eInvoiceOf(payment.id);
    if (!invoice) return null;
    return (
      <EInvoiceBadge
        invoice={invoice}
        syncing={sync.isPending && sync.variables === invoice.id}
        onSync={handleSync}
        onDownload={handleDownload}
      />
    );
  };

  const receipts = useMemo(() => query.data?.items ?? [], [query.data]);
  const pageRows = receipts.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("Treatment:Payment:PaymentNoun"));

  const handleView = (payment: PatientPaymentDto) => setReceipt(receiptOf(payment, plan, receipts));
  const handleAggregate = () => setReceipt(aggregateReceiptOf(plan, new Date()));

  /** Huỷ takes the movement back off the slip, so every rollup is recomputed. */
  const handleCancel = async () => {
    if (!cancelling) return;
    try {
      await remove.mutateAsync({ id: cancelling.id });
      toast.success(t("Treatment:Payment:CancelSuccess"));
      setCancelling(null);
    } catch (error) {
      notifyError(extractApiError(error) || t("Treatment:Payment:CancelError"));
    }
  };

  const columns = useMemo(
    () =>
      buildPaymentColumns(plan, {
        onView: handleView,
        onEdit: canUpdate ? setEditing : undefined,
        onCancel: canDelete ? setCancelling : undefined,
        onIssueInvoice: canFinalize ? setInvoicing : undefined,
        canIssueInvoice,
        renderEInvoice,
      }),
    [plan, receipts, canUpdate, canDelete, canFinalize, eInvoiceQuery.data, sync.isPending, sync.variables], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="pdt-pane">
      <div className="pdt-toolbar">
        {canCreate && (
          <button type="button" className="tp-btn tp-btn--primary" onClick={() => setCreating(true)}>
            <DollarSign size={16} aria-hidden="true" />
            {t("Treatment:Payment:CreatePayment")}
          </button>
        )}
        <button type="button" className="tp-btn tp-btn--outline" onClick={handleAggregate}>
          <Printer size={16} aria-hidden="true" />
          {t("Treatment:Payment:PrintTotalInvoice")}
        </button>
      </div>

      {narrow ? (
        <PaymentCardList
          payments={pageRows}
          total={receipts.length}
          pagination={pagination}
          cardRows={(payment) => paymentCardRows(payment, plan, renderEInvoice)}
          onView={handleView}
          onEdit={canUpdate ? setEditing : undefined}
          onCancel={canDelete ? setCancelling : undefined}
          onIssueInvoice={canFinalize ? setInvoicing : undefined}
          canIssueInvoice={canIssueInvoice}
          showTotal={showTotal}
        />
      ) : (
        <div className="bd-cat-card tp-table pdt-table">
          <DataTable<PatientPaymentDto>
            rowKey="id"
            loading={query.isLoading}
            columns={columns}
            dataSource={pageRows}
            pagination={pagination.buildConfig(receipts.length, showTotal)}
            locale={{ emptyText: t("Treatment:Common:NoData") }}
          />
        </div>
      )}

      <CreatePaymentDialog
        open={creating}
        patientId={patient.id}
        branchId={branchId}
        plan={plan}
        focusServiceId={null}
        heldForPatient={account.data?.heldForPatient ?? 0}
        onClose={() => setCreating(false)}
        onSaved={() => setCreating(false)}
      />
      <PaymentEditDialog
        payment={editing}
        branchId={branchId}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={cancelling !== null}
        noun={t("Treatment:Payment:PaymentNoun")}
        name={cancelling?.code}
        title={t("Treatment:Payment:CancelPaymentConfirm")}
        pending={remove.isPending}
        onConfirm={() => void handleCancel()}
        onClose={() => setCancelling(null)}
      />
      {invoicing && (
        <InvoiceModal open source={{ patientPaymentId: invoicing.id }} onClose={() => setInvoicing(null)} />
      )}
      <PaymentReceiptDialog
        receipt={receipt}
        patient={patient}
        clinic={clinic.data}
        dentistName={plan.dentistName}
        advises={advises.data?.items ?? []}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}
