import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { useBranchStaffOptions, useStaffPenaltyList, useStaffViolationTypes, type StaffPenaltyDto } from "../api/staffPenaltyApi";
import { PenaltyCancelDialog } from "../components/penalty/PenaltyCancelDialog";
import { penaltyColumns } from "../components/penalty/penaltyColumns";
import { PenaltyDetailDialog } from "../components/penalty/PenaltyDetailDialog";
import { PenaltyDialog } from "../components/penalty/PenaltyDialog";
import { PenaltyToolbar } from "../components/penalty/PenaltyToolbar";
import { ViolationTypeDialog } from "../components/penalty/ViolationTypeDialog";
import { StaffTabBar } from "../components/StaffTabBar";
import { usePenaltyActions } from "../hooks/usePenaltyActions";
import { usePenaltyFilters } from "../hooks/usePenaltyFilters";
import "../components/staff-penalty.css";

/** Nhân viên → Chế tài (/staff/penalties). BlueDental-local — docs/clone/pages/staff-penalty.md. */
export function StaffPenaltyPage() {
  const ability = useAbility("staffPenalty");
  const filters = usePenaltyFilters();
  const actions = usePenaltyActions();
  const [typesOpen, setTypesOpen] = useState(false);

  const { data, isLoading } = useStaffPenaltyList(filters.query);
  const { data: violationTypes = [] } = useStaffViolationTypes();
  const { data: staffOptions = [] } = useBranchStaffOptions();

  const { pending } = actions;
  const target: StaffPenaltyDto | null = pending.kind === "none" ? null : pending.penalty;

  return (
    <div className="reception-page">
      <PageHeader title={t("Staff:PageTitle")} subtitle={t("Staff:PageSubtitle")} />
      <StaffTabBar activeKey="penalties" />

      <PenaltyToolbar
        keyword={filters.keyword}
        onKeywordChange={filters.changeKeyword}
        range={filters.range}
        onRangeChange={filters.setRange}
        status={filters.status}
        onStatusChange={filters.setStatus}
        approvedFineTotal={data?.approvedFineTotal ?? 0}
        onCreate={ability.canCreate ? actions.openCreate : undefined}
        onManageTypes={() => setTypesOpen(true)}
      />

      <div className="page-card staff-penalty-table">
        <DataTable<StaffPenaltyDto>
          columns={penaltyColumns(ability, actions.handlers)}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          locale={{ emptyText: t("StaffPenalty:Empty") }}
          pagination={filters.pagination.buildConfig(data?.totalCount)}
        />
      </div>

      <PenaltyDialog
        open={pending.kind === "form"}
        penalty={target}
        staffOptions={staffOptions}
        violationTypes={violationTypes}
        saving={actions.saving}
        onSubmit={actions.submitForm}
        onClose={actions.close}
      />
      <ConfirmDialog
        open={pending.kind === "approve"}
        title={t("StaffPenalty:Approve")}
        message={t("StaffPenalty:ApproveConfirm", target?.staffName ?? "")}
        pending={actions.confirming}
        onConfirm={() => actions.confirm()}
        onClose={actions.close}
      />
      <PenaltyCancelDialog
        open={pending.kind === "cancel"}
        staffName={target?.staffName ?? ""}
        pending={actions.confirming}
        onConfirm={actions.confirm}
        onClose={actions.close}
      />
      <ConfirmDeleteDialog
        open={pending.kind === "delete"}
        noun={t("StaffPenalty:Noun")}
        name={target?.staffName ?? ""}
        pending={actions.confirming}
        onConfirm={() => actions.confirm()}
        onClose={actions.close}
      />
      <PenaltyDetailDialog penalty={pending.kind === "view" ? pending.penalty : null} onClose={actions.close} />
      <ViolationTypeDialog open={typesOpen} types={violationTypes} ability={ability} onClose={() => setTypesOpen(false)} />
    </div>
  );
}
