import { Empty, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { SUPPLY_STATUS, useSupplies } from "@/features/materials/api/suppliesApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

const MAX_ROWS = 5;

/** Items the stock service already flags as low — the count is its number, not ours. */
export function LowStockCard() {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const { data, isLoading } = useSupplies({
    branchId,
    status: SUPPLY_STATUS.LowStock,
    maxResultCount: MAX_ROWS,
  });

  const rows = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  return (
    <div className="page-card">
      <div className="dash-card-head" style={{ marginBottom: 12 }}>
        <div className="dash-card-title">{t("Vật tư dưới định mức")}</div>
        {total > 0 && <span className="dash-pill dash-pill--danger">{total}</span>}
      </div>

      {isLoading ? (
        <Spin size="small" />
      ) : rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Không có vật tư dưới định mức")}
        />
      ) : (
        <div className="dash-list">
          {rows.map((item) => (
            <button
              key={item.id}
              type="button"
              className="dash-stock-row"
              onClick={() => navigate("/materials")}
            >
              <span className="dash-stock-name">{item.name}</span>
              <span className="dash-stock-qty">{item.quantityOnHand}</span>
              <span className="dash-stock-min">
                / {item.reorderLevel} {item.unit ?? ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
