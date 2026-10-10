import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { OrgStaffDto } from "../../api/orgChartApi";
import { OrgAvatar } from "./OrgAvatar";

interface Props {
  person: OrgStaffDto;
  isHead?: boolean;
  /** A warning under the name, e.g. the unit the person moves out of. */
  note?: ReactNode;
  /** Trailing control, e.g. the remove button in a member list. */
  action?: ReactNode;
}

/** A person line: avatar, name, chức vụ, and the Trưởng / BS tags. */
export function OrgPersonRow({ person, isHead, note, action }: Props) {
  return (
    <div className="org-person">
      <OrgAvatar name={person.name} />
      <div className="org-person__text">
        <span className="org-person__name">
          {person.name}
          {isHead && <span className="org-tag org-tag--head">{t("OrgChart:Tag:Head")}</span>}
          {person.isDentist && <span className="org-tag org-tag--dentist">{t("OrgChart:Tag:Dentist")}</span>}
        </span>
        <span className="org-person__sub">{person.position || person.userName}</span>
        {note && <span className="org-person__note">{note}</span>}
      </div>
      {action}
    </div>
  );
}
