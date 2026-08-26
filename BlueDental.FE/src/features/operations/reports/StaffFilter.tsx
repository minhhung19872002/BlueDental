import { Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";

interface Props {
  /** "Người tạo" on the work log, "Nhân sự tư vấn" on the consultant report. */
  label: string;
  value?: string;
  onChange: (value?: string) => void;
}

/**
 * The staff picker the reference puts above several reports.
 *
 * Searchable, clearable, and empty means everybody — which is how the
 * reference leaves it.
 */
export function StaffFilter({ label, value, onChange }: Props) {
  const { data, isLoading } = useStaffOptions();

  return (
    <Select
      className="bd-ops-filter"
      showSearch
      allowClear
      loading={isLoading}
      placeholder={label}
      aria-label={label}
      suffixIcon={<SearchOutlined />}
      value={value}
      onChange={(next) => onChange(next ?? undefined)}
      optionFilterProp="label"
      options={data ?? []}
      notFoundContent={isLoading ? t("Đang tải…") : t("Không có dữ liệu")}
    />
  );
}
