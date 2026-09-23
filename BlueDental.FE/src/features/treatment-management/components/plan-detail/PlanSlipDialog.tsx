import { useMemo } from "react";
import { Modal, type TableColumnsType } from "antd";
import { Printer, X } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import type { TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { dash } from "./planDetailTypes";
import { PlanSlipSheet } from "./PlanSlipSheet";
import { printSheet } from "./printSheet";
import { ReceiptFacts, ReceiptTotals } from "./ReceiptParts";
import { slipViewOf, type SlipLine } from "./slipView";

interface Props {
  open: boolean;
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  /** The letterhead of the dialog and the printed sheet; undefined while it loads. */
  clinic: BranchInfo | undefined;
  onClose: () => void;
}

/** Teeth in blue over the service name — the first cell, as the reference draws it. */
function SlipServiceCell({ line }: { line: SlipLine }) {
  return (
    <div className="pdt-slip-service">
      {line.teethLabel && <strong>{line.teethLabel}</strong>}
      <span>{line.service.serviceName ?? line.service.code}</span>
    </div>
  );
}

function buildColumns(dentistName: string | null): TableColumnsType<SlipLine> {
  return [
    { key: "service", title: t("Treatment:Service:Service"), width: 220, render: (_, line) => <SlipServiceCell line={line} /> },
    { key: "status", title: t("Common:Status"), width: 140, render: (_, line) => line.statusLabel },
    { key: "dentist", title: t("Treatment:Common:DentistDoctor"), width: 160, render: () => dash(dentistName) },
    { key: "quantity", title: t("Treatment:Pricing:Quantity"), width: 90, align: "center", render: (_, line) => line.service.quantity },
    { key: "price", title: t("Treatment:Pricing:UnitPrice"), width: 140, align: "right", render: (_, line) => moneyText(line.service.price) },
    { key: "discount", title: t("Treatment:Pricing:Discount"), width: 140, align: "right", render: (_, line) => moneyText(line.service.discountAmount) },
    { key: "amount", title: t("Treatment:Pricing:NetAmount"), width: 150, align: "right", render: (_, line) => <strong>{moneyText(line.service.effectiveAmount)}</strong> },
  ];
}

/**
 * "Chi tiết phiếu" of the slip — the printer icon on the Chi tiết toolbar.
 * The clinic, the customer, every line of the slip and the money summary;
 * "In Phiếu" prints not this but the `PlanSlipSheet` beside it.
 */
export function PlanSlipDialog({ open, patient, plan, clinic, onClose }: Props) {
  const pagination = useTablePagination(20);
  const slip = useMemo(() => slipViewOf(plan, new Date()), [plan]);
  const pageLines = slip.lines.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const columns = useMemo(() => buildColumns(plan.dentistName), [plan.dentistName]);

  return (
    <Modal
      open={open}
      title={t("Treatment:Payment:ReceiptDetail")}
      className="tp-dialog pdt-print-dialog"
      width="min(1024px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      afterClose={pagination.resetToFirstPage}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--primary" onClick={printSheet}>
            <Printer size={16} aria-hidden="true" />
            {t("Treatment:Receipt:PrintSlip")}
          </button>
        </div>
      }
    >
      <PlanSlipSheet slip={slip} patient={patient} clinic={clinic} dentistName={plan.dentistName} />
      <article className="pdt-receipt pdt-screen">
        <div className="pdt-receipt-head">
          <section className="pdt-receipt-section">
            <h3>{t("Treatment:Common:ClinicBranch")}</h3>
            <ReceiptFacts
              facts={[
                { label: t("Treatment:Common:Clinic"), value: dash(clinic?.name) },
                { label: t("Treatment:Common:Address"), value: dash(clinic?.address) },
                { label: t("Treatment:Common:PhoneShort"), value: dash(clinic?.phone) },
                { label: t("Email"), value: dash(clinic?.email) },
              ]}
            />
          </section>
          <section className="pdt-receipt-section">
            <h3>{t("Treatment:Invoice:CustomerInfo")}</h3>
            <ReceiptFacts
              facts={[
                { label: t("Treatment:Common:PatientCodeShort"), value: patient.patientCode },
                { label: t("Treatment:Common:FullName"), value: patient.fullName },
              ]}
            />
          </section>
        </div>

        <section className="pdt-receipt-section">
          <h3>{t("Treatment:Service:ServiceDetail")}</h3>
          <div className="bd-cat-card tp-table pdt-table pdt-receipt-table">
            <DataTable<SlipLine>
              rowKey={(line) => line.service.id}
              columns={columns}
              dataSource={pageLines}
              pagination={pagination.buildConfig(slip.lines.length, countedTotal(t("Treatment:Service:ServiceNoun")))}
              locale={{ emptyText: t("Treatment:Common:NoData") }}
            />
          </div>
        </section>

        <section className="pdt-receipt-section pdt-receipt-sum">
          <h3>{t("Treatment:Pricing:TotalPayments")}</h3>
          <ReceiptTotals totals={slip.totals} />
        </section>
      </article>
    </Modal>
  );
}
