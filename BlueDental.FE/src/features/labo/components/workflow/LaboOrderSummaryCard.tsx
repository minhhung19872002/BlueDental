import type { ReactNode } from "react";
import { Button } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboSupplierBadge } from "../order-dialogs/laboOrderCells";

interface Props {
  order: LaboOrderDto;
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

/** The order at a glance above tabs 2 and 3: what was made, by whom, and when it is due. */
export function LaboOrderSummaryCard({ order, onShowOrder }: Props) {
  const teeth = [order.toothNumbers || "—", order.quantity, order.toothShade || "—"].join(" · ");
  return (
    <section className="pd-labo-summary-card" aria-label={t("Labo:Summary:Title")}>
      <Fact label={t("Labo:Summary:Service")}>{order.laboServiceName ?? order.materialName ?? "—"}</Fact>
      <Fact label={t("Labo:Summary:Teeth")}>{teeth}</Fact>
      <Fact label={t("Patient:Labo:Supplier")}>
        <LaboSupplierBadge name={order.labProviderName} color={order.supplierLabelColor} />
      </Fact>
      <Fact label={t("Patient:QuoteSheet:PrescribingDoctor")}>{order.dentistName ?? "—"}</Fact>
      <Fact label={t("Labo:Summary:SentAt")}>{order.sentAt ? formatDateTime(order.sentAt) : "—"}</Fact>
      <Fact label={t("Labo:Summary:DueAt")}>{order.dueAt ? formatDateTime(order.dueAt) : "—"}</Fact>
      <Fact label={t("Labo:Summary:ReturnCount")}>{order.returnCount}</Fact>
      <Fact label={t("Labo:Summary:Order")}>
        <Button type="link" size="small" className="pd-labo-summary-link" onClick={onShowOrder}>
          {t("Labo:Summary:ShowOrder")} <RightOutlined />
        </Button>
      </Fact>
    </section>
  );
}
