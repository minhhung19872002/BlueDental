import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  LABO_ORDER_KIND,
  useLaboStats,
  usePatientLaboOrders,
  type LaboOrderDto,
  type LaboOrderKind,
  type LaboStatsDto,
} from "@/features/labo/api/laboApi";
import type { PatientDto } from "../../../types/patient";
import { LaboDetailDialog } from "./LaboDetailDialog";
import { LaboOrderTabsDialog } from "./LaboOrderTabsDialog";
import { LABO_MODAL_PARAM, LABO_ROW_PARAM, type LaboModalKey } from "./laboModalKeys";
import { buildPatientLaboColumns } from "./patientLaboColumns";

/**
 * The three stat cards over the table, same as on Lịch hẹn; each filters the
 * list on the order kind, and each reads its number off the stats endpoint.
 */
const COUNTERS: ReadonlyArray<{
  kind: LaboOrderKind;
  label: string;
  tone: "green" | "amber" | "red";
  stat: keyof Pick<LaboStatsDto, "new" | "continueStage" | "guarantee">;
}> = [
  { kind: LABO_ORDER_KIND.New, label: "Đơn hàng mới", tone: "green", stat: "new" },
  {
    kind: LABO_ORDER_KIND.ContinueStage,
    label: "Tiếp tục công đoạn",
    tone: "amber",
    stat: "continueStage",
  },
  { kind: LABO_ORDER_KIND.Guarantee, label: "Bảo hành", tone: "red", stat: "guarantee" },
];

/** Tab 6 of the patient record: the patient's labo orders and the order dialog. */
export function PatientLaboTab({ patient }: { patient: PatientDto }) {
  const branchId = useCurrentBranchId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kind, setKind] = useState<LaboOrderKind | null>(null);
  const [detail, setDetail] = useState<LaboOrderDto | null>(null);
  const pagination = useTablePagination(20);

  // The server pages and filters; the tab never holds more than one page.
  const page = usePatientLaboOrders({
    patientId: patient.id,
    kind: kind ?? undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  // The counters count the whole record, not the page or the counter pressed.
  const stats = useLaboStats({ patientId: patient.id });

  const rows = page.data?.items ?? [];
  const totalCount = page.data?.totalCount ?? 0;

  const toggleKind = (next: LaboOrderKind) => {
    setKind((current) => (current === next ? null : next));
    pagination.resetToFirstPage();
  };

  const openDialog = (key: LaboModalKey, order?: LaboOrderDto) => {
    const next = new URLSearchParams(searchParams);
    next.set(LABO_MODAL_PARAM, key);
    if (order) next.set(LABO_ROW_PARAM, order.id);
    else next.delete(LABO_ROW_PARAM);
    setSearchParams(next, { replace: true });
  };

  const columns = buildPatientLaboColumns({
    onDetail: setDetail,
    onContinue: (order) => openDialog("continue-process", order),
    onWarranty: (order) => openDialog("warranty", order),
  });

  return (
    <section className="pd-pane pd-pane--fill">
      <div className="pd-record-toolbar">
        <div className="pd-stat-row pd-stat-row--equal">
          {COUNTERS.map(({ kind: counterKind, label, tone, stat }) => (
            <button
              type="button"
              key={counterKind}
              aria-pressed={kind === counterKind}
              className={`pd-stat pd-stat--${tone}${kind === counterKind ? " active" : ""}`}
              onClick={() => toggleKind(counterKind)}
            >
              <strong>{stats.data?.[stat] ?? 0}</strong>
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDialog("new-order")}>
          {t("Tạo phiếu Labo")}
        </Button>
      </div>
      <div className="bd-cat-card">
        <DataTable<LaboOrderDto>
          rowKey="id"
          loading={page.isLoading}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: t("Không có dữ liệu") }}
          pagination={pagination.buildConfig(totalCount, countedTotal(t("phiếu labo")))}
        />
      </div>
      <LaboOrderTabsDialog
        branchId={branchId}
        patient={{ id: patient.id, code: patient.patientCode, name: patient.fullName }}
      />
      <LaboDetailDialog
        order={detail}
        branchId={branchId}
        patient={{
          code: patient.patientCode,
          name: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
        }}
        onClose={() => setDetail(null)}
      />
    </section>
  );
}
