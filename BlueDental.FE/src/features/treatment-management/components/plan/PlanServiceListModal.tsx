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
  /** Diagnosis name per source advise; a service line carries only the advise id. */
  diagnosisByAdviseId: ReadonlyMap<string, string>;
  onClose: () => void;
}

function buildColumns(
  diagnosisByAdviseId: ReadonlyMap<string, string>,
): TableColumnsType<PlanServiceRow> {
  return [
    {
      key: "service",
      title: t("Dịch vụ"),
      width: 190,
      render: (_, { service }) => (
        <>
          <p className="tp-service-teeth">{formatTeeth(service.teeth)}</p>
          <p className="tp-service-name">{service.serviceName}</p>
        </>
      ),
    },
    {
      key: "diagnosis",
      title: t("Chẩn đoán"),
      width: 274,
      render: (_, { service }) =>
        (service.sourceAdviseId && diagnosisByAdviseId.get(service.sourceAdviseId)) || "—",
    },
    {
      key: "dentist",
      title: t("Bác sĩ"),
      width: 190,
      render: (_, { plan }) => plan.dentistName,
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
      render: (_, { service }) => <span className="tp-cell-money">{moneyText(service.price)}</span>,
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
export function PlanServiceListModal({ open, title, rows, diagnosisByAdviseId, onClose }: Props) {
  const pagination = useTablePagination(20);
  const narrow = useMediaQuery(NARROW_SCREEN);
  const columns = useMemo(() => buildColumns(diagnosisByAdviseId), [diagnosisByAdviseId]);
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
            locale={{ emptyText: t("Chưa có dịch vụ") }}
          />
        </div>
      )}
    </Modal>
  );
}
