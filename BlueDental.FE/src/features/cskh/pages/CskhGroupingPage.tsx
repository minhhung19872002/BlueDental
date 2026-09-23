import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { RemainingHeight } from "@/components/RemainingHeight";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { anchorForMode, careDateModeOf, careTabByKey, CARE_TABS } from "../careTabs";
import { CareBoard } from "../components/CareBoard";
import { CareDateBar } from "../components/CareDateBar";
import { GroupPatientsPanel } from "../components/GroupPatientsPanel";
import "../components/cskh.css";

type TopTabKey = "care" | "group";

const TOP_TABS: Array<{ key: TopTabKey; label: () => string }> = [
  { key: "care", label: () => t("CSKH:Tab:Care") },
  { key: "group", label: () => t("CSKH:Tab:Group") },
];

/**
 * /cskh-grouping — the reference keeps tab, page, care_dateMode, care_date and
 * taxonomyId in the URL; every other filter is transient component state.
 */
export function CskhGroupingPage() {
  const branchId = useCurrentBranchId();
  const [searchParams, setSearchParams] = useSearchParams();

  const careAbility = useAbility("cskhCare");
  const groupAbility = useAbility("cskhGroup");

  const tabAccess: Record<TopTabKey, boolean> = {
    care: careAbility.canRead,
    group: groupAbility.canRead,
  };
  const visibleTabs = useMemo(
    () => TOP_TABS.filter((item) => tabAccess[item.key]),
    [tabAccess.care, tabAccess.group], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rawTab = searchParams.get("tab");
  const topTab: TopTabKey =
    rawTab === "group" && tabAccess.group ? "group"
    : rawTab === "care" && tabAccess.care ? "care"
    : visibleTabs[0]?.key ?? "care";
  const careTab = careTabByKey(searchParams.get("page"));
  const mode = careDateModeOf(searchParams.get("care_dateMode"));
  const rawParam = searchParams.get("care_date");
  const rawDate = rawParam ? dayjs(rawParam) : null;
  const date = rawDate?.isValid() ? rawDate : anchorForMode(mode, dayjs());
  const taxonomyId = searchParams.get("taxonomyId") ?? undefined;

  const setParam = (mutate: (params: URLSearchParams) => void) => {
    setSearchParams((params) => {
      mutate(params);
      return params;
    });
  };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("CSKH:PageTitle")}
        subtitle={t("CSKH:PageSubtitle")}
      />

      <div className="pill-tabs-row">
        <div className="pill-tabs">
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={["pill-tab", topTab === item.key && "pill-tab--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setParam((params) => params.set("tab", item.key))}
            >
              {item.label()}
            </button>
          ))}
        </div>
      </div>

      {topTab === "care" ? (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill">
            <CareBoard
              branchId={branchId}
              tab={careTab}
              mode={mode}
              date={date}
              canExport={careAbility.canExport}
              canCreate={careAbility.canCreate}
              dateSlot={
                <CareDateBar
                  mode={mode}
                  date={date}
                  onModeChange={(nextMode) =>
                    setParam((params) => {
                      params.set("care_dateMode", nextMode);
                      params.set(
                        "care_date",
                        anchorForMode(nextMode, dayjs()).format("YYYY-MM-DD"),
                      );
                    })
                  }
                  onDateChange={(nextDate) =>
                    setParam((params) => params.set("care_date", nextDate.format("YYYY-MM-DD")))
                  }
                />
              }
              tabsSlot={
                <SegmentedTabs
                  items={CARE_TABS.map((item) => ({ key: item.key, label: item.label() }))}
                  activeKey={careTab.key}
                  onChange={(key) => setParam((params) => params.set("page", key))}
                />
              }
            />
          </div>
        </RemainingHeight>
      ) : (
        <RemainingHeight>
          <div className="reception-card reception-card--content cskh-card--fill">
            <GroupPatientsPanel
              branchId={branchId}
              taxonomyId={taxonomyId}
              canUpdate={groupAbility.canUpdate}
              onTaxonomyChange={(value) =>
                setParam((params) => {
                  if (value) params.set("taxonomyId", value);
                  else params.delete("taxonomyId");
                })
              }
            />
          </div>
        </RemainingHeight>
      )}
    </div>
  );
}
