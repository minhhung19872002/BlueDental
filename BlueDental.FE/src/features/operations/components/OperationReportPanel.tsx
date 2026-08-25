import { FileSearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  label: string;
}

/**
 * Stands in for a Vận hành sub-tab that is a report rather than the
 * category+article screen.
 *
 * The reference gives each of these its own columns over data this application
 * does not serve yet (invoices, completed services, consultations, revenue), so
 * there is nothing honest to draw here. It says so plainly instead of showing
 * the article screen and implying the sub-tab works.
 *
 * See docs/clone/pages/operations.md for the columns each one carries.
 */
export function OperationReportPanel({ label }: Props) {
  return (
    <div className="bd-ops-report">
      <FileSearchOutlined className="bd-icon--xl" aria-hidden="true" />
      <p className="bd-ops-report-title">{label}</p>
      <p className="bd-ops-report-note">
        {t("Báo cáo này chưa được dựng. Xem docs/clone/pages/operations.md.")}
      </p>
    </div>
  );
}
