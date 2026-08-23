// TreatmentHistoryTimeline — chronological view of all past treatments for a patient.
// TODO: Wire to treatment records API and render as Ant Design Timeline.

import { Empty } from "antd";
import { t } from "@/lib/i18n";

export function TreatmentHistoryTimeline() {
  return <Empty description={t("Lịch sử điều trị đang được phát triển.")} />;
}
