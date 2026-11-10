import type { ReactNode } from "react";
import { Button } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { LABO_CASE_TYPE, isRequestSlip, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboSupplierBadge } from "../order-dialogs/laboOrderCells";
import { laboWorkOf } from "../order-dialogs/laboRequestSlipText";

interface Props {
  order: LaboOrderDto;
  patient: { code: string; name: string };
  /** "Xem chi tiết >": back to the Đặt hàng tab. */
  onShowOrder: () => void;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pd-labo-summary-fact">
      <span className="pd-labo-summary-label">{label}</span>
      <span className="pd-labo-summary-value">{children}</span>
    </div>
  );
}

const dateOrDash = (value: string | null | undefined) => formatDate(value) || "—";

/**
 * The order at a glance above tabs 2 and 3, three by three as P3110 m175 /
 * m281 draw it: the slip and patient, what was made, by whom, and when. A
 * Phiếu yêu cầu order (F-91) has no supplier, so its Loại phiếu takes that cell.
 */
export function LaboOrderSummaryCard({ order, patient, onShowOrder }: Props) {
  const requestSlip = isRequestSlip(order);
  return (
    <section className="pd-labo-summary-card" aria-label={t("Labo:Summary:Title")}>
      <Fact label={t("Labo:Summary:OrderCode")}>
        <b>{laboOrderNo(order)}</b>
      </Fact>
      <Fact label={t("Patient:Form:CustomerName")}>{`${patient.code} – ${patient.name}`}</Fact>
      <Fact label={t("Labo:Summary:Service")}>{(requestSlip ? laboWorkOf(order) : (order.laboServiceName ?? order.materialName)) || "—"}</Fact>
      <Fact label={t("Labo:Summary:Teeth")}>{order.toothNumbers || "—"}</Fact>
      {requestSlip ? (
        <Fact label={t("Labo:Slip:CaseType")}>
          {t(order.caseType === LABO_CASE_TYPE.Redo ? "Labo:Slip:CaseRedo" : "Labo:Slip:CaseNew")}
        </Fact>
      ) : (
        <Fact label={t("Patient:Labo:Supplier")}>
          <LaboSupplierBadge name={order.labProviderName} color={order.supplierLabelColor} />
        </Fact>
      )}
      <Fact label={t("Patient:QuoteSheet:PrescribingDoctor")}>{order.dentistName ?? "—"}</Fact>
      <Fact label={t("Labo:Summary:SentAt")}>{dateOrDash(order.sentAt)}</Fact>
      <Fact label={t("Labo:Summary:DueAt")}>{dateOrDash(order.dueAt)}</Fact>
      <Fact label={t("Labo:Summary:Order")}>
        <Button type="link" size="small" className="pd-labo-summary-link" onClick={onShowOrder}>
          {t("Labo:Summary:ShowOrder")} <RightOutlined />
        </Button>
      </Fact>
    </section>
  );
}
