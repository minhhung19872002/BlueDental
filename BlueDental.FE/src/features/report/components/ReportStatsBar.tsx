import { Button, Spin } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import type { StatTone } from "./ReportStatCards";

interface Props {
  label: string;
  value: number;
  tone: StatTone;
  loading?: boolean;
  onExport?: () => void;
}

/**
 * Headline block of a tab-1 sub tab: the solid colour pill ("Thực thu ·
 * 1.300.000 đ") followed by an optional "Xuất Excel". Sits at the right of a
 * headline row.
 */
export function ReportStatsBar({ label, value, tone, loading, onExport }: Props) {
  return (
    <div className="report-stats-bar">
      <span className={`report-stats-pill report-stats-pill--${tone}`}>
        <span className="report-stats-label">{label}</span>
        {loading ? <Spin size="small" /> : <span className="report-stats-value">{formatVND(value)} đ</span>}
      </span>
      {onExport ? (
        <Button icon={<DownloadOutlined />} className="report-btn--blue" onClick={onExport}>
          {t("Xuất Excel")}
        </Button>
      ) : null}
    </div>
  );
}
