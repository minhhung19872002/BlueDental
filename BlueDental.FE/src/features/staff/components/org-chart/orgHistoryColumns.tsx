import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { OrgChartAction, OrgUnitChangeLogDto } from "../../api/orgChartApi";
import { OrgAvatar } from "./OrgAvatar";
import { ORG_KIND_CONFIG } from "./orgChartModel";

/** Badge colour and label per action — the same five the server logs. */
export const ORG_ACTION_CONFIG: Record<OrgChartAction, { modifier: string; labelKey: string }> = {
  1: { modifier: "green", labelKey: "OrgChart:Action:Created" },
  2: { modifier: "blue", labelKey: "OrgChart:Action:Updated" },
  3: { modifier: "red", labelKey: "OrgChart:Action:Deleted" },
  4: { modifier: "amber", labelKey: "OrgChart:Action:HeadChanged" },
  5: { modifier: "purple", labelKey: "OrgChart:Action:MembersAssigned" },
};

export function orgHistoryColumns(): ColumnsType<OrgUnitChangeLogDto> {
  return [
    {
      title: t("OrgChart:History:Time"),
      dataIndex: "occurredAt",
      width: 150,
      render: (value: string) => <span className="org-nowrap">{dayjs(value).format("DD/MM/YYYY HH:mm")}</span>,
    },
    {
      title: t("OrgChart:History:Unit"),
      dataIndex: "orgUnitName",
      render: (_, row) => (
        <span className="org-history-unit">
          <span className={`org-dot org-dot--${ORG_KIND_CONFIG[row.orgUnitKind].modifier}`} />
          {row.orgUnitName}
        </span>
      ),
    },
    {
      title: t("OrgChart:History:Action"),
      dataIndex: "action",
      width: 170,
      render: (action: OrgChartAction) => (
        <span className={`org-pill org-pill--${ORG_ACTION_CONFIG[action].modifier}`}>
          {t(ORG_ACTION_CONFIG[action].labelKey)}
        </span>
      ),
    },
    {
      title: t("OrgChart:History:Fields"),
      dataIndex: "changes",
      render: (_, row) => row.changes.map((c) => t(`OrgChart:Field:${c.field}`)).join(", ") || "—",
    },
    {
      title: t("OrgChart:History:Actor"),
      dataIndex: "actorName",
      width: 200,
      render: (name: string | null) =>
        name ? (
          <span className="org-history-actor">
            <OrgAvatar name={name} />
            {name}
          </span>
        ) : (
          t("OrgChart:History:System")
        ),
    },
  ];
}
