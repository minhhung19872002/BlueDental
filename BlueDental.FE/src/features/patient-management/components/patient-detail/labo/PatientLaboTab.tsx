import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  useLaboStats,
  usePatientLaboOrders,
  type LaboOrderDto,
  type LaboStatusFilter,
} from "@/features/labo/api/laboApi";
import { LaboDeleteOrderDialog } from "@/features/labo/components/workflow/LaboDeleteOrderDialog";
import { LaboStatusFilterCards } from "@/features/labo/components/workflow/LaboStatusFilterCards";
import { LaboWorkflowDialog } from "@/features/labo/components/workflow/LaboWorkflowDialog";
import { useLaboWorkflowUrl } from "@/features/labo/components/workflow/useLaboWorkflowUrl";
import type { PatientDto } from "../../../types/patient";
import { buildPatientLaboColumns } from "./patientLaboColumns";

/** Tab 6 of the patient record: the patient's labo orders and the one Labo dialog. */
export function PatientLaboTab({ patient }: { patient: PatientDto }) {
  const ability = useAbility("treatmentLabo");
  const branchId = useCurrentBranchId();
  const dialog = useLaboWorkflowUrl();
  const [statusFilter, setStatusFilter] = useState<LaboStatusFilter | null>(null);
  const [deleting, setDeleting] = useState<LaboOrderDto | null>(null);
  const pagination = useTablePagination(20);

  // The server pages and filters; the tab never holds more than one page.
  const page = usePatientLaboOrders({
    patientId: patient.id,
    statusFilter: statusFilter ?? undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const stats = useLaboStats({ patientId: patient.id });

  const handleFilterChange = (next: LaboStatusFilter | null) => {
    setStatusFilter(next);
    pagination.resetToFirstPage();
  };

  const columns = buildPatientLaboColumns(
    {
      onDetail: (order) => dialog.openOrder(order.id),
      onCheck: ability.canUpdate ? (order) => dialog.openOrder(order.id, "check") : undefined,
      onWarranty: ability.canUpdate ? (order) => dialog.openOrder(order.id, "warranty") : undefined,
      onDelete: ability.canDelete ? setDeleting : undefined,
    },
    { patientId: patient.id, branchId },
  );

  return (
    <section className="pd-pane pd-pane--fill">
      <div className="pd-record-toolbar">
        <LaboStatusFilterCards stats={stats.data} selected={statusFilter} onChange={handleFilterChange} />
        {ability.canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={dialog.openCreate}>
            {t("Patient:Labo:CreateSlip")}
          </Button>
        )}
      </div>
      <div className="bd-cat-card">
        <DataTable<LaboOrderDto>
          rowKey="id"
          loading={page.isLoading}
          columns={columns}
          dataSource={page.data?.items ?? []}
          locale={{ emptyText: t("Common:NoData") }}
          pagination={pagination.buildConfig(
            page.data?.totalCount ?? 0,
            countedTotal(t("Patient:Misc:LaboSlip")),
          )}
        />
      </div>
      <LaboWorkflowDialog
        target={dialog.target}
        branchId={branchId}
        patient={{ id: patient.id, code: patient.patientCode, name: patient.fullName }}
        onStepChange={dialog.setStep}
        onClose={dialog.close}
      />
      <LaboDeleteOrderDialog order={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}
