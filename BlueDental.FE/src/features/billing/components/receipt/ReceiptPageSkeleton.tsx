import { Skeleton } from "antd";
import { t } from "@/lib/i18n";

const STEP_COUNT = 6;

/**
 * The receipt page while its receipt and iPad state load: the same head,
 * step bar, sheet and column, greyed — so nothing jumps when they arrive and
 * no step shows "—" before its time is known.
 */
export function ReceiptPageSkeleton() {
  return (
    <div className="page-container rcpt-page" aria-busy="true" aria-label={t("Common:Loading")}>
      <div className="rcpt-head">
        <Skeleton.Button active size="small" className="rcpt-skel-back" />
        <div className="rcpt-head-main">
          <Skeleton.Input active size="small" className="rcpt-skel-crumbs" />
          <Skeleton.Input active className="rcpt-skel-title" />
        </div>
      </div>
      <section className="rcpt-track-card">
        <ol className="step-track">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <li key={index} className="step-track-item step-track-item--todo">
              <Skeleton.Avatar active size={24} />
              <Skeleton.Input active size="small" className="rcpt-skel-step" />
            </li>
          ))}
        </ol>
      </section>
      <div className="rcpt-body">
        <div className="rcpt-sheet">
          <Skeleton active title={{ width: 180 }} paragraph={{ rows: 2, width: [240, 160] }} />
          <Skeleton active title={false} paragraph={{ rows: 6 }} />
        </div>
        <div className="rcpt-panel">
          <Skeleton active title={{ width: 200 }} paragraph={{ rows: 3 }} />
          <div className="rcpt-panel-actions">
            <Skeleton.Button active />
            <Skeleton.Button active />
          </div>
        </div>
      </div>
    </div>
  );
}
