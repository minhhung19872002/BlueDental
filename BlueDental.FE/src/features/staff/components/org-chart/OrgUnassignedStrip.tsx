import { Button } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { OrgStaffDto } from "../../api/orgChartApi";

const VISIBLE_CHIPS = 12;

interface Props {
  staff: OrgStaffDto[];
  /** Absent when the account may not change the chart. */
  onAssign?: () => void;
}

/** "Chưa thuộc đơn vị nào (n)": active staff outside every unit, and the button that places them. */
export function OrgUnassignedStrip({ staff, onAssign }: Props) {
  const hidden = staff.length - VISIBLE_CHIPS;

  return (
    <section className="org-unassigned" aria-label={t("OrgChart:Unassigned:Title", staff.length)}>
      <div className="org-unassigned__body">
        <h2 className="org-unassigned__title">{t("OrgChart:Unassigned:Title", staff.length)}</h2>
        {staff.length === 0 ? (
          <span className="org-muted">{t("OrgChart:Unassigned:None")}</span>
        ) : (
          <ul className="org-unassigned__chips">
            {staff.slice(0, VISIBLE_CHIPS).map((person) => (
              <li key={person.id} className="org-chip">
                {person.name}
              </li>
            ))}
            {hidden > 0 && <li className="org-chip org-chip--more">+{hidden}</li>}
          </ul>
        )}
        <span className="org-unassigned__note">{t("OrgChart:Unassigned:Note")}</span>
      </div>
      {onAssign && staff.length > 0 && (
        <Button icon={<ApartmentOutlined />} onClick={onAssign}>
          {t("OrgChart:Action:Assign")}
        </Button>
      )}
    </section>
  );
}
