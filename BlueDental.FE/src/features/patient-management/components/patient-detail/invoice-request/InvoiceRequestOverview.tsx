import { Button } from "antd";
import { PlusOutlined, WarningFilled } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { InvoiceRequestStatsDto } from "../../../api/invoiceRequestApi";
import {
  INVOICE_REQUEST_FILTERS,
  filterCount,
  filterLabel,
  type InvoiceRequestFilter,
} from "./invoiceRequestStatus";

interface HeaderProps {
  onCreate?: () => void;
}

/** Title, the line under it and "+ Tạo yêu cầu xuất HĐ". */
export function InvoiceRequestHeader({ onCreate }: HeaderProps) {
  return (
    <div className="ir-head">
      <div>
        <h3 className="ir-head__title">{t("Patient:InvoiceRequest:Title")}</h3>
        <p className="ir-head__sub">{t("Patient:InvoiceRequest:Subtitle")}</p>
      </div>
      {onCreate && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("Patient:InvoiceRequest:Create")}
        </Button>
      )}
    </div>
  );
}

interface BannerProps {
  stats: InvoiceRequestStatsDto | undefined;
  onShowOpen: () => void;
}

/** "3 yêu cầu đang chờ kế toán · 1 đã quá hạn" — only while something is open. */
export function InvoiceRequestBanner({ stats, onShowOpen }: BannerProps) {
  if (!stats || stats.open === 0) return null;
  return (
    <div className="ir-banner" role="status">
      <WarningFilled className="ir-banner__icon" />
      <span className="ir-banner__text">
        <strong>{t("Patient:InvoiceRequest:Banner", stats.open)}</strong>
        {stats.overdue > 0 && <span className="ir-banner__late">{t("Patient:InvoiceRequest:BannerOverdue", stats.overdue)}</span>}
      </span>
      <Button size="small" onClick={onShowOpen}>
        {t("Patient:InvoiceRequest:BannerAction")}
      </Button>
    </div>
  );
}

interface ChipsProps {
  value: InvoiceRequestFilter;
  stats: InvoiceRequestStatsDto | undefined;
  onChange: (next: InvoiceRequestFilter) => void;
}

/** One chip per filter, each carrying the count of the whole record. */
export function InvoiceRequestChips({ value, stats, onChange }: ChipsProps) {
  return (
    <div className="ir-chips" role="group" aria-label={t("Patient:InvoiceRequest:FilterLabel")}>
      {INVOICE_REQUEST_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            className={["ir-chip", active && "ir-chip--active"].filter(Boolean).join(" ")}
            onClick={() => onChange(filter)}
          >
            {filterLabel(filter)}
            <span className="ir-chip__count">{filterCount(filter, stats)}</span>
          </button>
        );
      })}
    </div>
  );
}
