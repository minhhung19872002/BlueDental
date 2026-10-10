import { EyeOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type CreatableOrgUnitKind } from "../../api/orgChartApi";
import { descendantsOf, type OrgChartIndex } from "./orgChartModel";

interface Props {
  index: OrgChartIndex;
  kind: CreatableOrgUnitKind;
  /** The unit being edited; null while creating. */
  selfUnitId: string | null;
  headStaffId?: string;
  memberIds: string[];
}

/**
 * "Xem trước phạm vi dữ liệu sau khi lưu": whose Lịch làm việc / Chấm công
 * the head will see once the form is saved — the unit's people plus everyone
 * in the teams already under it.
 */
export function OrgScopePreview({ index, kind, selfUnitId, headStaffId, memberIds }: Props) {
  const below = selfUnitId ? descendantsOf(index, selfUnitId).flatMap((u) => u.members.map((m) => m.id)) : [];
  const people = new Set([...(headStaffId ? [headStaffId] : []), ...memberIds, ...below]);
  const head = index.activeStaff.find((s) => s.id === headStaffId);
  // The chart only narrows what a dentist sees; anyone else keeps the role permissions.
  const headLine = !head
    ? t("OrgChart:Preview:NoHead")
    : head.isDentist
      ? t("OrgChart:Preview:Head", head.name, people.size)
      : t("OrgChart:Preview:HeadNonDentist", head.name);

  return (
    <section className="org-preview" aria-label={t("OrgChart:Preview:Title")}>
      <h3 className="org-preview__title">
        <EyeOutlined /> {t("OrgChart:Preview:Title")}
      </h3>
      <ul className="org-preview__list">
        <li>{headLine}</li>
        <li>{t(kind === ORG_UNIT_KIND.Department ? "OrgChart:Preview:DepartmentMembers" : "OrgChart:Preview:TeamMembers")}</li>
        <li>{t("OrgChart:Preview:Other")}</li>
      </ul>
    </section>
  );
}
