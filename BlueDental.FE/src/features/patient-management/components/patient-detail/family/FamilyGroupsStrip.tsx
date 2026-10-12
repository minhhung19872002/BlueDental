import { Link } from "react-router-dom";
import { Spin, Tag } from "antd";
import { AlertOutlined, HomeOutlined } from "@ant-design/icons";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { usePatientGroupsOf } from "../../../api/familyApi";

const FAMILY = 1;

/** The strip sits in the hồ sơ editor; leaving in place would drop what is typed there. */
const NEW_TAB = { target: "_blank", rel: "noreferrer" } as const;

/**
 * The record's Hồ sơ nhóm (4.10) above its people (owner, 2026-10-12): the
 * family group it belongs to — the members themselves are rows of the list
 * below — and any other groups, as links. Groups are edited on /patient-group.
 * Needs patientGroup.read.
 */
export function FamilyGroupsStrip({ patientId }: { patientId: string }) {
  const { canRead, canCreate } = useAbility("patientGroup");
  const { data: groups = [], isLoading } = usePatientGroupsOf(patientId, canRead);
  if (!canRead) return null;
  if (isLoading) return <Spin size="small" />;

  const family = groups.find((g) => g.kind === FAMILY);
  const others = groups.filter((g) => g.kind !== FAMILY);

  return (
    <section className="pf-groups" aria-label={t("PatientGroup:Title")}>
      <div className="pf-family">
        <HomeOutlined className="pf-section__icon" />
        {family ? (
          <>
            <div className="pf-family__body">
              <strong>{family.name}</strong>
              <small>
                {[family.headName ? t("Patient:Family:HeadOf", family.headName) : null, t("Patient:Family:MemberCount", family.memberCount)]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              {family.sharedMedicalNote ? (
                <p className="pf-group__medical">
                  <AlertOutlined /> {family.sharedMedicalNote}
                </p>
              ) : null}
            </div>
            <Link to={`/patient-group?open=${family.id}`} {...NEW_TAB} className="pf-section__link">
              {t("PatientGroup:Open")}
            </Link>
          </>
        ) : (
          <>
            <span className="pf-empty pf-family__body">{t("Patient:Family:NoFamilyGroup")}</span>
            {canCreate ? (
              <Link to={`/patient-group?new=${patientId}`} {...NEW_TAB} className="pf-section__link">
                {t("Patient:Family:CreateFamilyGroup")}
              </Link>
            ) : null}
          </>
        )}
      </div>
      {others.length > 0 ? (
        <div className="pf-groups__others">
          <small>{t("Patient:Family:OtherGroups")}:</small>
          {others.map((g) => (
            <Link key={g.id} to={`/patient-group?open=${g.id}`} {...NEW_TAB}>
              <Tag color="blue">{g.name}</Tag>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
