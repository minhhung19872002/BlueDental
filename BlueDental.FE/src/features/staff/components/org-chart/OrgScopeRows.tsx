import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type OrgUnitKind } from "../../api/orgChartApi";
import { ORG_KIND_CONFIG, ORG_SCOPE_KEY } from "./orgChartModel";

interface Props {
  kind: OrgUnitKind;
}

/**
 * "Phạm vi dữ liệu được xem" box as on the BA mock: badge, one-line rule, then
 * screen → reach. Only Lịch làm việc / Chấm công follow the chart (BA
 * 2026-10-10); every other screen keeps the role permissions, so that row says
 * so instead of repeating a rule the chart does not apply.
 */
export function OrgScopeRows({ kind }: Props) {
  const badge = t(ORG_KIND_CONFIG[kind].scopeBadgeKey);

  return (
    <section className="org-scope" aria-label={t("OrgChart:Detail:Scope")}>
      <header className="org-scope__head">
        <h3>{t("OrgChart:Detail:Scope")}</h3>
        <span className="org-scope__badge">{badge}</span>
      </header>
      <p className="org-scope__intro">{t(ORG_SCOPE_KEY[kind])}</p>
      <dl className="org-scope__rows">
        <div>
          <dt>{t("OrgChart:Scope:WorkSchedule")}</dt>
          <dd>{badge}</dd>
        </div>
        <div>
          <dt>{t("OrgChart:Scope:Timekeeping")}</dt>
          <dd>{badge}</dd>
        </div>
        <div>
          <dt>{t("OrgChart:Scope:Other")}</dt>
          <dd>{t("OrgChart:Scope:ByPermission")}</dd>
        </div>
      </dl>
      {kind !== ORG_UNIT_KIND.Root && <p className="org-scope__sub">{t("OrgChart:Scope:MemberDentist")}</p>}
      <p className="org-scope__sub">{t("OrgChart:Scope:NonDentist")}</p>
    </section>
  );
}
