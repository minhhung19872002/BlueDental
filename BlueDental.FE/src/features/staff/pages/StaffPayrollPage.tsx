import { useState } from "react";
import { Segmented } from "antd";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { PAYROLL_STATUS, type PayrollEntry } from "../api/payrollApi";
import { CompensationPanel } from "../components/payroll/CompensationPanel";
import { payrollColumns } from "../components/payroll/payrollColumns";
import { PayrollEntryDialog } from "../components/payroll/PayrollEntryDialog";
import { PayrollTermsDialog } from "../components/payroll/PayrollTermsDialog";
import { PayrollToolbar } from "../components/payroll/PayrollToolbar";
import { StaffTabBar } from "../components/StaffTabBar";
import { usePayrollActions } from "../hooks/usePayrollActions";
import { usePayrollMonth } from "../hooks/usePayrollMonth";
import "../components/payroll/payroll.css";

type View = "sheet" | "compensation";

/** Nhân viên → Bảng lương (/staff/payroll). BlueDental-local — docs/clone/pages/payroll.md. */
export function StaffPayrollPage() {
  const ability = useAbility("payroll");
  const [view, setView] = useState<View>("sheet");
  const { month, setMonth, label, period, loading } = usePayrollMonth();
  const actions = usePayrollActions(period);
  const draft = period?.status === PAYROLL_STATUS.Draft;
  const { pending } = actions;

  return (
    <div className="reception-page">
      <PageHeader title={t("Staff:PageTitle")} subtitle={t("Staff:PageSubtitle")} />
      <StaffTabBar activeKey="payroll" />

      <Segmented<View>
        className="payroll-views"
        value={view}
        onChange={setView}
        options={[
          { value: "sheet", label: t("Payroll:TabSheet") },
          { value: "compensation", label: t("Payroll:TabCompensation") },
        ]}
      />

      {view === "compensation" ? (
        <CompensationPanel canEdit={ability.canUpdate} />
      ) : (
        <>
          <PayrollToolbar
            month={month}
            onMonthChange={setMonth}
            period={period}
            busy={actions.recalculating}
            actions={{
              onRecalculate: ability.canUpdate ? actions.recalculate : undefined,
              onTerms: ability.canUpdate ? () => actions.open({ kind: "terms" }) : undefined,
              onFinalize: ability.canApprove ? () => actions.open({ kind: "finalize" }) : undefined,
              onExport: ability.canExport ? actions.download : undefined,
              onDelete: ability.canDelete ? () => actions.open({ kind: "delete" }) : undefined,
            }}
          />
          <div className="page-card payroll-table">
            {!loading && !period ? (
              <EmptyState
                title={t("Payroll:Empty", label)}
                description={t("Payroll:EmptyHint")}
                actionLabel={ability.canCreate ? t("Payroll:Create") : undefined}
                onAction={ability.canCreate ? () => actions.create(month.year(), month.month() + 1) : undefined}
              />
            ) : (
              <>
                <p className="payroll-hint">{t("Payroll:Formula")}</p>
                <DataTable<PayrollEntry>
                  columns={payrollColumns(
                    draft && ability.canUpdate ? (entry) => actions.open({ kind: "entry", entry }) : undefined,
                  )}
                  dataSource={period?.entries ?? []}
                  rowKey="staffId"
                  loading={loading}
                  pagination={false}
                  scroll={{ x: 1700 }}
                />
              </>
            )}
          </div>
        </>
      )}

      <PayrollEntryDialog
        entry={pending.kind === "entry" ? pending.entry : null}
        saving={actions.saving}
        onSubmit={actions.saveEntry}
        onClose={actions.close}
      />
      <PayrollTermsDialog
        period={pending.kind === "terms" && period ? period : null}
        saving={actions.saving}
        onSubmit={actions.saveTerms}
        onClose={actions.close}
      />
      <ConfirmDialog
        open={pending.kind === "finalize"}
        title={t("Payroll:Finalize")}
        message={t("Payroll:FinalizeConfirm", label)}
        confirmLabel={t("Payroll:Finalize")}
        pending={actions.confirming}
        onConfirm={actions.confirm}
        onClose={actions.close}
      />
      <ConfirmDeleteDialog
        open={pending.kind === "delete"}
        noun={t("Payroll:Noun")}
        name={label}
        pending={actions.confirming}
        onConfirm={actions.confirm}
        onClose={actions.close}
      />
    </div>
  );
}
