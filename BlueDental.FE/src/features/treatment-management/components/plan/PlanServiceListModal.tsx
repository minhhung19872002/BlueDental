import { useMemo } from "react";
import { Modal, type TableColumnsType } from "antd";
import { X } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatTeeth } from "../../api/consultingApi";
import { PlanServiceCardList } from "./PlanServiceCardList";
import { SERVICE_PILL, moneyText, type PlanServiceRow } from "./planTypes";

interface Props {
  open: boolean;
  title: string;
  rows: PlanServiceRow[];
  /**
   * Print the slip's DT code in front of each service name. The reference does
   * this on one slip's list — where the code is also a link back to that slip —
   * and leaves it off on "Xem tất cả dịch vụ" (measured 2026-09-21).
   */
  showCode?: boolean;
  /** Diagnosis name per source advise; a service line carries only the advise id. */
  diagnosisByAdviseId: ReadonlyMap<string, string>;
  onClose: () => void;
  onOpenPlan?: (planId: string) => void;
}

interface ColumnOptions {
  showCode: boolean;
  diagnosisByAdviseId: ReadonlyMap<string, string>;
  onOpenPlan?: (planId: string) => void;
}

/** The reference's Đơn giá is the line's net amount spread over its quantity. */
function unitPrice(amount: number, quantity: number): number {
  return Math.round(amount / Math.max(quantity, 1));
}

function buildColumns({
  showCode,
  diagnosisByAdviseId,
  onOpenPlan,
}: ColumnOptions): TableColumnsType<PlanServiceRow> {
  return [
    {
      key: "service",
      title: t("Dịch vụ"),
      width: 190,
      render: (_, { plan, service }) => (
        <>
          <p className="tp-service-teeth">{formatTeeth(service.teeth) || "—"}</p>
          <p className="tp-service-name">
            {showCode && (
              <button
                type="button"
                className="tp-service-code"
                onClick={() => onOpenPlan?.(plan.id)}
              >
                {plan.code}
              </button>
            )}
            {service.serviceName || "—"}
          </p>
        </>
      ),
    },
    {
      key: "diagnosis",
      title: t("Chẩn đoán"),
      width: 274,
      render: (_, { service }) =>
        service.diagnosisName ||
        (service.sourceAdviseId && diagnosisByAdviseId.get(service.sourceAdviseId)) ||
        "—",
    },
    {
      key: "dentist",
      // The line's own treating dentist, not the slip's — they differ once a
      // line is reassigned, and the reference prints the line's.
      title: t("Bác sĩ"),
      width: 190,
      render: (_, { plan, service }) => service.dentistName || plan.dentistName || "—",
    },
    {
      key: "status",
      title: t("Trạng thái"),
      width: 190,
      render: (_, { service }) => {
        const pill = SERVICE_PILL[service.status] ?? SERVICE_PILL[1];
        return (
          <span className={["tp-pill", pill.modifier].filter(Boolean).join(" ")}>
            {t(pill.label)}
          </span>
        );
      },
    },
    {
      key: "price",
      title: t("Đơn giá"),
      width: 168,
      align: "right",
      render: (_, { service }) => (
        <span className="tp-cell-money">
          {moneyText(unitPrice(service.effectiveAmount, service.quantity))}
        </span>
      ),
    },
    {
      key: "amount",
      title: t("Thành tiền"),
      width: 179,
      align: "right",
      render: (_, { service }) => (
        <span className="tp-cell-money">{moneyText(service.effectiveAmount)}</span>
      ),
    },
  ];
}

/** Phones get the cards from "Thêm đơn thuốc" instead of a sideways-scrolling table. */
const NARROW_SCREEN = "(max-width: 640px)";

/**
 * "Danh sách dịch vụ": one row per service line. Opened for a single slip from
 * the eye button, or for every slip from "Xem tất cả dịch vụ".
 */
export function PlanServiceListModal({
  open,
  title,
  rows,
  showCode = false,
  diagnosisByAdviseId,
  onClose,
  onOpenPlan,
}: Props) {
  const pagination = useTablePagination(20);
  const narrow = useMediaQuery(NARROW_SCREEN);
  const columns = useMemo(
    () => buildColumns({ showCode, diagnosisByAdviseId, onOpenPlan }),
    [showCode, diagnosisByAdviseId, onOpenPlan],
  );
  const pageRows = rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1240px, calc(100vw - 32px))"
      className="tp-dialog"
      title={title}
      closeIcon={<X size={20} aria-hidden="true" />}
      destroyOnHidden
    >
      {narrow ? (
        <PlanServiceCardList
          rows={pageRows}
          total={rows.length}
          offset={pagination.skipCount}
          diagnosisByAdviseId={diagnosisByAdviseId}
          pagination={pagination}
        />
      ) : (
        <div className="bd-cat-card tp-table tp-services-table">
          <DataTable<PlanServiceRow>
            rowKey={(row) => row.service.id}
            columns={columns}
            dataSource={pageRows}
            pagination={pagination.buildConfig(rows.length)}
            locale={{ emptyText: t("Không có dữ liệu") }}
          />
        </div>
      )}
    </Modal>
  );
}
