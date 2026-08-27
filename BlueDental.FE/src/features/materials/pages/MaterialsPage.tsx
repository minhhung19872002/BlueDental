import { useParams } from "react-router-dom";
import { AllocationTab } from "../components/AllocationTab";
import { ClinicMaterialsTab } from "../components/ClinicMaterialsTab";
import { DepartmentTab } from "../components/DepartmentTab";
import { findMaterialsTab, materialsTabs } from "../materialsTabs";
import { PageTabBar } from "@/components/PageTabBar";
import { t } from "@/lib/i18n";

/**
 * Vật tư — three sections, each its own route, as the reference makes them.
 *
 * The page itself only chooses between them; each section owns its own data and
 * its own shape, because the reference draws all three differently: two have a
 * panel beside the table and one does not.
 */
export function MaterialsPage() {
  const { section } = useParams<{ section?: string }>();
  const tab = findMaterialsTab(section);

  return (
    <div className="bd-taxonomy-page">
      <PageTabBar
        label={t("Vật tư")}
        activeKey={tab.key}
        tabs={materialsTabs().map((item) => ({
          key: item.key,
          label: item.label,
          to: `/materials/${item.key}`,
        }))}
      />

      <div className="bd-min0h bd-flex1">
        {tab.key === "clinic" && <ClinicMaterialsTab />}
        {tab.key === "allocation" && <AllocationTab />}
        {tab.key === "department" && <DepartmentTab />}
      </div>
    </div>
  );
}

export default MaterialsPage;
