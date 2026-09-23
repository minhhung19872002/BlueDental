import { useParams } from "react-router-dom";
import { LaboCatalogScreen } from "../components/LaboCatalogScreen";
import { LaboOrdersScreen } from "../components/LaboOrdersScreen";
import { LaboServiceMaterialScreen } from "../components/LaboServiceMaterialScreen";
import { LaboSupplierScreen } from "../components/LaboSupplierScreen";
import { DEFAULT_LABO_TAB, findLaboTab, laboTabs, type LaboTab } from "../laboTabs";
import { PageHeader } from "@/components/PageHeader";
import { PageTabBar } from "@/components/PageTabBar";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import "../components/labo.css";

function LaboScreen({ tab }: { tab: LaboTab }) {
  // Ability is resolved per-screen with the tab's own subject so each screen
  // sees only its own permission leaf.
  const ability = useAbility(tab.subject);

  switch (tab.screen) {
    case "orders":
      return <LaboOrdersScreen canExport={ability.canExport} />;
    case "supplier":
      return (
        <LaboSupplierScreen
          canCreate={ability.canCreate}
          canUpdate={ability.canUpdate}
          canDelete={ability.canDelete}
        />
      );
    case "catalog":
      return (
        <LaboCatalogScreen
          tab={tab}
          canCreate={ability.canCreate}
          canUpdate={ability.canUpdate}
          canDelete={ability.canDelete}
        />
      );
    case "service-material":
      return (
        <LaboServiceMaterialScreen
          canCreate={ability.canCreate}
          canUpdate={ability.canUpdate}
          canDelete={ability.canDelete}
        />
      );
  }
}

/**
 * Labo.
 *
 * Six sub-screens, each its own URL as the reference has them, so a tab can be
 * bookmarked, shared and reached with the back button. The shell is the tab row
 * and nothing else — each tab brings its own screen.
 *
 * Tabs the user may not read are filtered out; the active tab falls back to the
 * first visible one when the URL names a hidden tab.
 *
 * Each tab's `subject` drives both visibility (canRead) and the per-screen
 * button gates (canCreate / canUpdate / canDelete / canExport). The subjects
 * are static strings defined in laboTabs.ts, so the hook count never changes
 * between renders.
 */
export function LaboPage() {
  const allTabs = laboTabs();

  // One useAbility call per tab — subjects are static, so hook count is stable.
  const abilityTemplate = useAbility(allTabs[0].subject);
  const abilitySupplier = useAbility(allTabs[1].subject);
  const abilityBite = useAbility(allTabs[2].subject);
  const abilityFinishLine = useAbility(allTabs[3].subject);
  const abilityRhythm = useAbility(allTabs[4].subject);
  const abilityMaterial = useAbility(allTabs[5].subject);

  const abilitiesByIndex = [
    abilityTemplate,
    abilitySupplier,
    abilityBite,
    abilityFinishLine,
    abilityRhythm,
    abilityMaterial,
  ];

  const tabs = allTabs.filter((_, i) => abilitiesByIndex[i].canRead);

  const { section } = useParams();
  // Fall back to all tabs if every tab is hidden (permissions not yet loaded)
  // so findLaboTab can still return a sensible default.
  const tab = findLaboTab(tabs.length > 0 ? tabs : allTabs, section ?? DEFAULT_LABO_TAB);

  return (
    <div className="bd-shell-page">
      <PageHeader
        title={t("Labo:PageTitle")}
        subtitle={t("Labo:PageSubtitle")}
      />

      <div className="bd-labo-page">
        <PageTabBar
          label={t("Labo:PageTitle")}
          activeKey={tab.key}
          tabs={tabs.map((item) => ({ key: item.key, label: item.label, to: `/labo/${item.key}` }))}
        />

        <LaboScreen key={tab.key} tab={tab} />
      </div>
    </div>
  );
}
