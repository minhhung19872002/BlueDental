import { useMemo } from "react";
import { Button, Checkbox, Input, Select } from "antd";
import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { t } from "@/lib/i18n";
import type { HistoryAction, HistorySource, HistoryStatusGroup } from "../../types/appointmentHistory";
import {
  ACTION_META,
  ACTION_ORDER,
  SOURCE_LABELS,
  SOURCE_ORDER,
  STATUS_GROUP_META,
  STATUS_GROUP_ORDER,
} from "./historyLabels";
import { HISTORY_WEEK_START, type HistoryFilterValues } from "./useHistoryFilters";

interface Props {
  values: HistoryFilterValues;
  dirty: boolean;
  onChange: (change: Partial<HistoryFilterValues>) => void;
  onClear: () => void;
}

interface Option<K extends string> {
  value: K;
  label: string;
}

function useFilterOptions() {
  return useMemo(
    () => ({
      actions: ACTION_ORDER.map<Option<HistoryAction>>((key) => ({
        value: key,
        label: t(ACTION_META[key].label),
      })),
      statuses: STATUS_GROUP_ORDER.map<Option<HistoryStatusGroup>>((key) => ({
        value: key,
        label: t(STATUS_GROUP_META[key].label),
      })),
      sources: SOURCE_ORDER.map<Option<HistorySource>>((key) => ({
        value: key,
        label: t(SOURCE_LABELS[key]),
      })),
    }),
    [],
  );
}

/**
 * The three pick-lists take any number of values, as on the reference; an
 * empty one means "all". Chosen values show as small tags, overflow folded
 * into a "+n" tag so the 160px box keeps its height.
 */
const MULTI = {
  mode: "multiple" as const,
  allowClear: true,
  showSearch: false,
  maxTagCount: "responsive" as const,
  maxTagPlaceholder: (omitted: unknown[]) => `+${omitted.length}`,
  popupMatchSelectWidth: false,
};

/** The week navigator, three dropdowns, two search boxes, the important-only toggle and Xóa lọc. */
export function HistoryFilterBar({ values, dirty, onChange, onClear }: Props) {
  const options = useFilterOptions();

  return (
    <div className="ah-filters" data-testid="ah-filters">
      <DateNavigator
        mode="week"
        weekStartsOn={HISTORY_WEEK_START}
        value={values.week}
        onChange={(week) => onChange({ week })}
        className="ah-week"
      />
      <Select<HistoryAction[]>
        {...MULTI}
        className="ah-select"
        placeholder={t("Tất cả hành động")}
        options={options.actions}
        value={values.actions}
        onChange={(actions) => onChange({ actions })}
      />
      <Select<HistoryStatusGroup[]>
        {...MULTI}
        className="ah-select"
        placeholder={t("Tất cả trạng thái")}
        options={options.statuses}
        value={values.statuses}
        onChange={(statuses) => onChange({ statuses })}
      />
      <Select<HistorySource[]>
        {...MULTI}
        className="ah-select"
        placeholder={t("Tất cả nguồn")}
        options={options.sources}
        value={values.sources}
        onChange={(sources) => onChange({ sources })}
      />
      <Input
        allowClear
        className="ah-input"
        prefix={<SearchOutlined />}
        placeholder={t("Tên hoặc username")}
        value={values.actor}
        onChange={(e) => onChange({ actor: e.target.value })}
      />
      <Input
        allowClear
        className="ah-input ah-input--wide"
        placeholder={t("Tìm trong ghi chú, mô tả...")}
        value={values.keyword}
        onChange={(e) => onChange({ keyword: e.target.value })}
      />
      <label className="ah-check">
        <Checkbox
          checked={values.importantOnly}
          onChange={(e) => onChange({ importantOnly: e.target.checked })}
        />
        <span>{t("Chỉ hiển thị thay đổi quan trọng")}</span>
      </label>
      <Button
        type="text"
        className="ah-clear"
        icon={<CloseOutlined />}
        disabled={!dirty}
        onClick={onClear}
      >
        {t("Xóa lọc")}
      </Button>
    </div>
  );
}
