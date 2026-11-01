import { ExclamationCircleFilled, RightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import { toothLabel } from "./laboToothSpecs";
import type { LaboPriorGroup } from "./laboPriorTeeth";

interface Props {
  groups: LaboPriorGroup[];
  onView: (order: LaboOrderDto) => void;
}

/** "Đã nhận 20/10/2026" once the Labo delivered, else where the order stands. */
function stateOf(order: LaboOrderDto): string {
  if (order.receivedAt) return t("Labo:Prior:Received", formatDate(order.receivedAt));
  return t(laboStatusPill(order).label);
}

/**
 * Under Răng on the Đặt hàng tab (P0111_02, R-1106): each earlier order of the
 * same phiếu điều trị that already carries a picked tooth — its code,
 * material, supplier and state, and «Xem phiếu ›» to look at it. Only a
 * warning: Tạo phiếu Labo still goes, a remake or warranty being the reason.
 */
export function LaboPriorOrderWarning({ groups, onView }: Props) {
  if (groups.length === 0) return null;
  return (
    <div className="pd-labo-prior" role="alert">
      <ExclamationCircleFilled className="pd-labo-prior-icon" aria-hidden />
      <div className="pd-labo-prior-body">
        {groups.map(({ order, teeth }) => (
          <div key={order.id} className="pd-labo-prior-order">
            <div className="pd-labo-prior-text">
              <b className="pd-labo-prior-title">{t("Labo:Prior:Title", teeth.map(toothLabel).join(", "))}</b>
              <p>
                <span className="pd-labo-prior-code">{order.orderCode}</span>
                {[order.materialName, order.supplierName ?? order.labProviderName, stateOf(order)]
                  .filter(Boolean)
                  .map((part) => ` · ${part}`)
                  .join("")}
              </p>
            </div>
            <button type="button" className="pd-labo-prior-view" onClick={() => onView(order)}>
              {t("Labo:Prior:View")} <RightOutlined aria-hidden />
            </button>
          </div>
        ))}
        <p className="pd-labo-prior-hint">{t("Labo:Prior:Hint")}</p>
      </div>
    </div>
  );
}
