import { useParams } from "react-router-dom";
import { LaboCatalogScreen } from "../components/LaboCatalogScreen";
import { LaboOrdersScreen } from "../components/LaboOrdersScreen";
import { LaboServiceMaterialScreen } from "../components/LaboServiceMaterialScreen";
import { LaboSupplierScreen } from "../components/LaboSupplierScreen";
import { DEFAULT_LABO_TAB, findLaboTab, laboTabs, type LaboTab } from "../laboTabs";
import { PageTabBar } from "@/components/PageTabBar";
import { t } from "@/lib/i18n";
import "../components/labo.css";

function LaboScreen({ tab }: { tab: LaboTab }) {
  switch (tab.screen) {
    case "orders":
      return <LaboOrdersScreen />;
    case "supplier":
      return <LaboSupplierScreen />;
    case "catalog":
      return <LaboCatalogScreen tab={tab} />;
    case "service-material":
      return <LaboServiceMaterialScreen />;
  }
}

/**
 * Labo.
 *
 * Six sub-screens, each its own URL as the reference has them, so a tab can be
 * bookmarked, shared and reached with the back button. The shell is the tab row
 * and nothing else — each tab brings its own screen.
 */
export function LaboPage() {
  const tabs = laboTabs();
  const { section } = useParams();
  const tab = findLaboTab(tabs, section ?? DEFAULT_LABO_TAB);

  return (
    <div className="bd-labo-page">
      <PageTabBar
        label={t("Labo")}
        activeKey={tab.key}
        tabs={tabs.map((item) => ({ key: item.key, label: item.label, to: `/labo/${item.key}` }))}
      />

      <LaboScreen key={tab.key} tab={tab} />
    </div>
  );
}
