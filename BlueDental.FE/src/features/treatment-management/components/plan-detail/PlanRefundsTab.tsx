import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { usePatientAdvises } from "../../api/consultingQueries";
import {
  PAYMENT_KIND,
  usePatientAccount,
  usePatientPayments,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { PaymentCardList } from "./PaymentCardList";
import { PaymentReceiptDialog } from "./PaymentReceiptDialog";
import { RefundDialog } from "./RefundDialog";
import { buildRefundColumns, refundCardRows } from "./paymentColumns";
import { receiptOf, type ReceiptView } from "./receiptView";

const NARROW_SCREEN = "(max-width: 640px)";
const PAGE_CAP = 200;

interface Props {
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  branchId: string;
}

/** Tab "Hoàn tiền": refunds filed against this slip and the "Hoàn Tiền" button. */
export function PlanRefundsTab({ patient, plan, branchId }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  const pagination = useTablePagination(20);
  const query = usePatientPayments({
    patientId: patient.id,
    clinicBranchId: branchId,
    treatmentPlanId: plan.id,
    kind: PAYMENT_KIND.Refund,
    maxResultCount: PAGE_CAP,
  });
  const account = usePatientAccount(patient.id, branchId);
  const clinic = useBranchInfo(branchId);
  const advises = usePatientAdvises({ patientId: patient.id, clinicBranchId: branchId, maxResultCount: PAGE_CAP });

  const [creating, setCreating] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);

  const refunds = useMemo(() => query.data?.items ?? [], [query.data]);
  const pageRows = refunds.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const showTotal = countedTotal(t("phiếu hoàn tiền"));

  const handleView = (payment: PatientPaymentDto) => setReceipt(receiptOf(payment, plan, refunds));
  const columns = useMemo(() => buildRefundColumns(plan, handleView), [plan, refunds]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pdt-pane">
      <div className="pdt-toolbar">
        <button type="button" className="tp-btn tp-btn--primary" onClick={() => setCreating(true)}>
          <Undo2 size={16} aria-hidden="true" />
          {t("Hoàn Tiền")}
        </button>
      </div>

      {narrow ? (
        <PaymentCardList
          payments={pageRows}
          total={refunds.length}
          pagination={pagination}
          cardRows={(payment) => refundCardRows(payment, plan)}
          onView={handleView}
          showTotal={showTotal}
        />
      ) : (
        <div className="bd-cat-card tp-table pdt-table">
          <DataTable<PatientPaymentDto>
            rowKey="id"
            loading={query.isLoading}
            columns={columns}
            dataSource={pageRows}
            pagination={pagination.buildConfig(refunds.length, showTotal)}
            locale={{ emptyText: t("Không có dữ liệu") }}
          />
        </div>
      )}

      <RefundDialog
        open={creating}
        plan={plan}
        branchId={branchId}
        refunds={refunds}
        heldForPatient={account.data?.heldForPatient ?? 0}
        onClose={() => setCreating(false)}
        onSaved={() => setCreating(false)}
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
