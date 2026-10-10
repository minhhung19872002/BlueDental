import { useCallback, useMemo, useRef, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useOrgChart, type OrgUnitDto } from "../api/orgChartApi";
import { OrgAssignDialog } from "../components/org-chart/OrgAssignDialog";
import { OrgChartHistoryModal } from "../components/org-chart/OrgChartHistoryModal";
import { OrgChartToolbar } from "../components/org-chart/OrgChartToolbar";
import { OrgChartTree } from "../components/org-chart/OrgChartTree";
import { indexOrgChart, normalizeUnitName } from "../components/org-chart/orgChartModel";
import { OrgRootHeadDialog } from "../components/org-chart/OrgRootHeadDialog";
import { OrgUnassignedStrip } from "../components/org-chart/OrgUnassignedStrip";
import { OrgUnitDetailPanel } from "../components/org-chart/OrgUnitDetailPanel";
import { OrgUnitDialog } from "../components/org-chart/OrgUnitDialog";
import { StaffTabBar } from "../components/StaffTabBar";
import { useOrgChartActions } from "../hooks/useOrgChartActions";
import "../components/org-chart/org-chart.css";

/** Matches the CSS breakpoint where the detail card drops below the tree. */
const SINGLE_COLUMN_QUERY = "(max-width: 1100px)";

/** Nhân viên → Sơ đồ tổ chức (/staff/org-chart). BlueDental-local — docs/clone/pages/org-chart.md. */
export function StaffOrgChartPage() {
  const ability = useAbility("orgChart");
  const actions = useOrgChartActions();
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const needle = normalizeUnitName(useDebounce(keyword, 250));
  const panelRef = useRef<HTMLElement>(null);

  // On a narrow screen the card sits under the tree, so a tap on a node would show nothing new without this.
  const handleTreeSelect = useCallback((unitId: string) => {
    setSelectedId(unitId);
    if (window.matchMedia(SINGLE_COLUMN_QUERY).matches) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  const { data, isLoading } = useOrgChart();
  const index = useMemo(() => indexOrgChart(data), [data]);
  // A deleted or not-yet-picked unit falls back to the root.
  const selected = (selectedId && index.byId.get(selectedId)) || index.root;

  const { pending } = actions;
  const editing = pending.kind === "edit" ? pending.unit : null;
  const deleting = pending.kind === "delete" ? pending.unit : null;

  const detailActions = ability.canUpdate
    ? {
        onEdit: (unit: OrgUnitDto) => actions.open({ kind: "edit", unit }),
        onAddMembers: (unitId: string) => actions.open({ kind: "assign", unitId }),
        onChangeRootHead: () => actions.open({ kind: "rootHead" }),
      }
    : undefined;

  return (
    <div className="reception-page">
      <PageHeader title={t("Staff:PageTitle")} subtitle={t("Staff:PageSubtitle")} />
      <StaffTabBar activeKey="orgChart" />

      <OrgChartToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onHistory={() => actions.open({ kind: "history" })}
        onCreate={ability.canCreate ? () => actions.open({ kind: "create" }) : undefined}
      />

      <div className="org-layout">
        <OrgChartTree
          index={index}
          loading={isLoading}
          selectedId={selected?.id ?? null}
          needle={needle}
          onSelect={handleTreeSelect}
        >
          <OrgUnassignedStrip
            staff={index.unassigned}
            onAssign={
              ability.canUpdate ? () => actions.open({ kind: "assign", unitId: null }) : undefined
            }
          />
        </OrgChartTree>
        {selected && (
          <OrgUnitDetailPanel
            ref={panelRef}
            index={index}
            unit={selected}
            actions={detailActions}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <OrgUnitDialog
        open={pending.kind === "create" || pending.kind === "edit"}
        unit={editing}
        index={index}
        saving={actions.saving}
        error={actions.saveError}
        onDelete={ability.canDelete ? (unit) => actions.open({ kind: "delete", unit }) : undefined}
        onSubmit={actions.saveUnit}
        onClose={actions.close}
      />
      <ConfirmDeleteDialog
        open={pending.kind === "delete"}
        noun={t("OrgChart:Noun")}
        name={deleting?.name ?? ""}
        note={t("OrgChart:Delete:Note")}
        pending={actions.deleting}
        onConfirm={actions.removeUnit}
        onClose={actions.close}
      />
      <OrgAssignDialog
        open={pending.kind === "assign"}
        unitId={pending.kind === "assign" ? pending.unitId : null}
        index={index}
        saving={actions.assigning}
        onSubmit={actions.assign}
        onClose={actions.close}
      />
      <OrgRootHeadDialog
        open={pending.kind === "rootHead"}
        index={index}
        saving={actions.assigning}
        onSubmit={actions.changeRootHead}
        onClose={actions.close}
      />
      <OrgChartHistoryModal open={pending.kind === "history"} onClose={actions.close} />
    </div>
  );
}
