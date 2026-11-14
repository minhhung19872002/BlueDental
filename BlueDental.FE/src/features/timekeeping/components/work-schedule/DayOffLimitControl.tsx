import { useState } from "react";
import { Button, InputNumber } from "antd";
import { LoadingOutlined, SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { DayOffLimit } from "../../types/workSchedule";

/** Mirrors ClinicBranch.MaxDayOffDaysCeiling. */
const MAX_CEILING = 31;

interface Props {
  limit: DayOffLimit;
  saving: boolean;
  onSave: (maxDayOffDays: number) => void;
}

/**
 * The branch's day-off limit on the board toolbar (BA 2026-11-14): admin
 * edits it, everyone else reads it. Remount with `key={limit.max}` to pick up
 * a saved value.
 */
export function DayOffLimitControl({ limit, saving, onSave }: Props) {
  const [value, setValue] = useState<number | null>(limit.max);

  if (!limit.exempt) {
    return <span className="ws-limit ws-limit--read">{t("Timekeeping:Board:Limit:ReadOnly", limit.max)}</span>;
  }

  const unchanged = value === null || value === limit.max;
  const handleSave = () => {
    if (value !== null && !unchanged && !saving) onSave(value);
  };

  return (
    <div className="ws-limit">
      <span className="ws-limit-label">{t("Timekeeping:Board:Limit:Label")}</span>
      <InputNumber
        className="ws-limit-input"
        min={1}
        max={MAX_CEILING}
        step={1}
        precision={0}
        value={value}
        onChange={setValue}
        onPressEnter={handleSave}
        aria-label={t("Timekeeping:Board:Limit:Label")}
      />
      <Button
        icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
        disabled={saving || unchanged}
        onClick={handleSave}
      >
        {t("Timekeeping:Board:Limit:Save")}
      </Button>
    </div>
  );
}
