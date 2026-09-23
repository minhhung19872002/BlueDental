import { Button, Input, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { VoucherFilterStatus } from "../api/voucherApi";

const STATUS_FILTER_OPTIONS: { value: VoucherFilterStatus | ""; label: () => string }[] = [
  { value: "", label: () => t("Voucher:AllStatuses") },
  { value: "created", label: () => t("Voucher:StatusCreated") },
  { value: "active", label: () => t("Voucher:StatusActive") },
  { value: "out_of_uses", label: () => t("Voucher:StatusOutOfUses") },
  { value: "expired", label: () => t("Voucher:StatusExpired") },
];

interface Props {
  keyword: string;
  statusFilter: string;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onCreateClick?: () => void;
}

export function VoucherToolbar({
  keyword,
  statusFilter,
  onKeywordChange,
  onStatusFilterChange,
  onCreateClick,
}: Props) {
  return (
    <div className="voucher-toolbar">
      <Input
        prefix={<SearchOutlined />}
        placeholder={t("Voucher:SearchPlaceholder")}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        style={{ width: 280 }}
        allowClear
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        style={{ width: 180 }}
        options={STATUS_FILTER_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label(),
        }))}
      />
      {onCreateClick && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginLeft: "auto" }}
          onClick={onCreateClick}
        >
          {t("Voucher:CreateBtn")}
        </Button>
      )}
    </div>
  );
}
