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
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  PAYMENT_KIND,
  useDeletePayment,
  usePatientAccount,
  usePatientPayments,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
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
  const { canCreate } = useAbility("payment");
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

  const receipts = useMemo(() => query.data?.items ?? [], [query.data]);
  const pageRows = receipts.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("phiếu thanh toán"));

  const handleView = (payment: PatientPaymentDto) => setReceipt(receiptOf(payment, plan, receipts));
  const handleAggregate = () => setReceipt(aggregateReceiptOf(plan, new Date()));

  /** Huỷ takes the movement back off the slip, so every rollup is recomputed. */
  const handleCancel = async () => {
    if (!cancelling) return;
    try {
      await remove.mutateAsync({ id: cancelling.id });
      toast.success(t("Đã huỷ phiếu thanh toán"));
      setCancelling(null);
    } catch (error) {
      notifyError(extractApiError(error) || t("Không thể huỷ phiếu thanh toán"));
    }
  };

  const columns = useMemo(
    () => buildPaymentColumns(plan, { onView: handleView, onEdit: setEditing, onCancel: setCancelling }),
    [plan, receipts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="pdt-pane">
      <div className="pdt-toolbar">
        {canCreate && (
          <button type="button" className="tp-btn tp-btn--primary" onClick={() => setCreating(true)}>
            <DollarSign size={16} aria-hidden="true" />
            {t("Tạo Phiếu Thanh Toán")}
          </button>
        )}
        <button type="button" className="tp-btn tp-btn--outline" onClick={handleAggregate}>
          <Printer size={16} aria-hidden="true" />
          {t("In hóa đơn tổng")}
        </button>
      </div>

      {narrow ? (
        <PaymentCardList
          payments={pageRows}
          total={receipts.length}
          pagination={pagination}
          cardRows={(payment) => paymentCardRows(payment, plan)}
          onView={handleView}
          onEdit={setEditing}
          onCancel={setCancelling}
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
            locale={{ emptyText: t("Không có dữ liệu") }}
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
        noun={t("phiếu thanh toán")}
        name={cancelling?.code}
        title={t("Xác nhận huỷ phiếu thanh toán")}
        pending={remove.isPending}
        onConfirm={() => void handleCancel()}
        onClose={() => setCancelling(null)}
      />
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
