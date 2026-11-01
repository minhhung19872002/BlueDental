import { useState } from "react";
import type { CatalogComboOption } from "@/hooks/useCatalogCombos";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { AdviseComboNotice } from "./AdviseComboNotice";
import { AdviseComboTable } from "./AdviseComboTable";
import { AdviseQuickCreate } from "./AdviseQuickCreate";
import { AdviseServiceTable } from "./AdviseServiceTable";
import { AdviseSideNav } from "./AdviseSideNav";
import { AdviseToolbar } from "./AdviseToolbar";
import type { useAdviseCatalog } from "./useAdviseCatalog";
import type { useAdviseCombos } from "./useAdviseCombos";
import type { AdviseSelection } from "./useAdviseSelection";

interface Props {
  catalog: ReturnType<typeof useAdviseCatalog>;
  combos: ReturnType<typeof useAdviseCombos>;
  selection: AdviseSelection;
}

/**
 * The left and middle columns of "Chọn dịch vụ" (P0111_02, R-1114): the
 * Dịch vụ lẻ / Combo switch with the groups, then the search bar, the combo
 * suggestion and the list. "Chỉ xem đã chọn" narrows the list to what is
 * ticked — held here, since the ticks outlive any group or search.
 */
export function AdvisePickerPane({ catalog, combos, selection }: Props) {
  const [onlyPicked, setOnlyPicked] = useState(false);
  const combo = combos.kind === "combo";
  const pickedServices = [...selection.rows.values()].map((row) => row.service);
  const pickedCombos = [...selection.combos.values()];
  const count = combo
    ? onlyPicked ? pickedCombos.length : combos.combos.length
    : onlyPicked ? pickedServices.length : catalog.servicesTotal;

  // A quick-added entry comes back ticked, with the list cleared to show it.
  const handleServiceCreated = (service: CatalogOption) => {
    catalog.setGroupId(service.taxonomyId);
    catalog.setSearch("");
    selection.toggle(service, true);
  };
  const handleComboCreated = (created: CatalogComboOption) => {
    combos.setSearch("");
    selection.toggleCombo(created, true);
  };

  return (
    <>
      <AdviseSideNav
        kind={combos.kind}
        singleCount={catalog.servicesTotal}
        comboCount={combos.total}
        groups={catalog.groups}
        activeGroupId={catalog.groupId}
        loading={catalog.groupsLoading}
        hasMore={catalog.hasMoreGroups}
        onKindChange={combos.setKind}
        onGroupChange={catalog.setGroupId}
        onLoadMore={catalog.loadMoreGroups}
      />
      <section className="am-main">
        <AdviseToolbar
          kind={combos.kind}
          search={combo ? combos.search : catalog.search}
          onlyPicked={onlyPicked}
          count={count}
          onSearchChange={combo ? combos.setSearch : catalog.setSearch}
          onOnlyPickedChange={setOnlyPicked}
          action={
            <AdviseQuickCreate
              kind={combos.kind}
              groupId={catalog.groupId}
              onServiceCreated={handleServiceCreated}
              onComboCreated={handleComboCreated}
            />
          }
        />
        {combos.suggestion && !combo && (
          <AdviseComboNotice suggestion={combos.suggestion} onApply={() => combos.setKind("combo")} />
        )}
        {combo ? (
          <AdviseComboTable
            combos={onlyPicked ? pickedCombos : combos.combos}
            loading={!onlyPicked && combos.loading}
            picked={selection.combos}
            onToggle={selection.toggleCombo}
          />
        ) : (
          <AdviseServiceTable
            services={onlyPicked ? pickedServices : catalog.services}
            loading={!onlyPicked && catalog.servicesLoading}
            loadingMore={!onlyPicked && catalog.servicesLoadingMore}
            hasMore={!onlyPicked && catalog.hasMoreServices}
            selection={selection}
            onLoadMore={catalog.loadMoreServices}
          />
        )}
      </section>
    </>
  );
}
