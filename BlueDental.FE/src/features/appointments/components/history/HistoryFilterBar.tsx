import { useMemo } from "react";
import { Button, Checkbox, Input, Select } from "antd";
import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { t } from "@/lib/i18n";
import type { HistoryAction, HistoryStatusGroup } from "../../types/appointmentHistory";
import {
  ACTION_META,
  ACTION_ORDER,
  STATUS_GROUP_META,
  STATUS_GROUP_ORDER,
} from "./historyLabels";
import { HISTORY_WEEK_START, type HistoryFilterValues } from "./useHistoryFilters";

interface Props {
  values: HistoryFilterValues;
  /** Off when the dialog reads one appointment's whole history. */
  showWeek: boolean;
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
    }),
    [],
  );
}

/**
 * The two pick-lists take any number of values, as on the reference; an
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

/** The week navigator, two dropdowns, two search boxes, the important-only toggle and Xóa lọc. */
export function HistoryFilterBar({ values, showWeek, dirty, onChange, onClear }: Props) {
  const options = useFilterOptions();

  return (
    <div className="ah-filters" data-testid="ah-filters">
      {showWeek && (
        <DateNavigator
          mode="week"
          weekStartsOn={HISTORY_WEEK_START}
          value={values.week}
          onChange={(week) => onChange({ week })}
          className="ah-week"
        />
      )}
      <Select<HistoryAction[]>
        {...MULTI}
        className="ah-select"
        placeholder={t("Appointment:History:Filter:AllActions")}
        options={options.actions}
        value={values.actions}
        onChange={(actions) => onChange({ actions })}
      />
      <Select<HistoryStatusGroup[]>
        {...MULTI}
        className="ah-select"
        placeholder={t("Appointment:History:Filter:AllStatuses")}
        options={options.statuses}
        value={values.statuses}
        onChange={(statuses) => onChange({ statuses })}
      />
      <Input
        allowClear
        className="ah-input"
        prefix={<SearchOutlined />}
        placeholder={t("Appointment:History:Filter:NameOrUsername")}
        value={values.actor}
        onChange={(e) => onChange({ actor: e.target.value })}
      />
      <Input
        allowClear
        className="ah-input ah-input--wide"
        placeholder={t("Appointment:History:Filter:SearchNotes")}
        value={values.keyword}
        onChange={(e) => onChange({ keyword: e.target.value })}
      />
      <label className="ah-check">
        <Checkbox
          checked={values.importantOnly}
          onChange={(e) => onChange({ importantOnly: e.target.checked })}
        />
        <span>{t("Appointment:History:Filter:ImportantOnly")}</span>
      </label>
      <Button
        type="text"
        className="ah-clear"
        icon={<CloseOutlined />}
        disabled={!dirty}
        onClick={onClear}
      >
        {t("Appointment:History:Filter:ClearFilters")}
      </Button>
    </div>
  );
}
