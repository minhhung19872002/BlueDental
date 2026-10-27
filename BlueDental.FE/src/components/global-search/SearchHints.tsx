import {
  CalendarOutlined,
  HeartOutlined,
  IdcardOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";

/** What the empty state offers before anything has been typed. */
const searchCategories = () => [
  {
    icon: <UserOutlined />,
    title: t("Common:Patient"),
    desc: t("Common:SearchPatientHint"),
  },
  {
    icon: <CalendarOutlined />,
    title: t("Common:Appointment"),
    desc: t("Common:SearchAppointmentHint"),
  },
  {
    icon: <HeartOutlined />,
    title: t("Common:CSKH"),
    desc: t("Common:SearchCSKHHint"),
  },
  {
    icon: <IdcardOutlined />,
    title: t("Common:Staff"),
    desc: t("Common:SearchStaffHint"),
  },
];

/** The palette before two characters are typed: what each group matches on. */
export function SearchHints() {
  return (
    <div className="app-search-categories">
      <div className="app-search-categories-title">{t("Common:SearchHints")}</div>
      {searchCategories().map((cat) => (
        <div key={cat.title} className="app-search-category-item">
          <span className="app-search-category-icon">{cat.icon}</span>
          <div className="app-search-category-text">
            <span className="app-search-category-name">{cat.title}</span>
            <span className="app-search-category-desc">{cat.desc}</span>
          </div>
        </div>
      ))}
      <div className="app-search-hint">{t("Common:MinCharsHint")}</div>
    </div>
  );
}
