import { Button, Input, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { VoucherFilterStatus } from "../api/voucherApi";

const STATUS_FILTER_OPTIONS: { value: VoucherFilterStatus | ""; label: () => string }[] = [
  { value: "", label: () => t("Tất cả trạng thái") },
  { value: "created", label: () => t("Đã tạo") },
  { value: "active", label: () => t("Đang hoạt động") },
  { value: "out_of_uses", label: () => t("Hết lượt") },
  { value: "expired", label: () => t("Hết hạn") },
];

interface Props {
  keyword: string;
  statusFilter: string;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onCreateClick: () => void;
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
        placeholder={t("Tìm theo mã hoặc tên voucher...")}
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
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ marginLeft: "auto" }}
        onClick={onCreateClick}
      >
        {t("Tạo voucher")}
      </Button>
    </div>
  );
}
