import { useState } from "react";
import { Button, Checkbox, Input, Popover } from "antd";
import { DownOutlined, ExclamationCircleOutlined, SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { PRESCRIPTION_USAGE } from "@/types/prescriptionUsage";
import { usageLabel, usageOptions, type UsageValue } from "./types";

interface Props {
  value: UsageValue;
  onChange: (next: UsageValue) => void;
}

/**
 * "Sử dụng" — a multi-select, the way the reference builds it.
 *
 * Nothing leaves this popover until "Lưu" is pressed: the boxes edit a draft,
 * so a half-made choice never reaches the line behind it. Ticking "Khác" asks
 * for the usage in words and will not save without it, as the reference does.
 */
export function UsagePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UsageValue>(value);
  const [error, setError] = useState<string | null>(null);

  // Re-opening starts from what is actually stored, not from an abandoned draft.
  const show = (next: boolean) => {
    if (next) {
      setDraft(value);
      setError(null);
    }
    setOpen(next);
  };

  const wantsOther = (draft.usage & PRESCRIPTION_USAGE.Other) !== 0;

  const commit = () => {
    if (wantsOther && !draft.otherUsage?.trim()) {
      setError(t("Vui lòng nhập giá trị!"));
      return;
    }

    onChange({
      usage: draft.usage,
      otherUsage: wantsOther ? (draft.otherUsage?.trim() ?? null) : null,
    });
    setOpen(false);
  };

  const content = (
    <div className="bd-usage-picker">
      {usageOptions().map((option) => {
        const checked = (draft.usage & option.flag) !== 0;
        return (
          <Checkbox
            key={option.flag}
            checked={checked}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                usage: event.target.checked
                  ? current.usage | option.flag
                  : current.usage & ~option.flag,
              }))
            }
          >
            {option.label}
          </Checkbox>
        );
      })}

      {wantsOther && (
        <div className="bd-usage-other">
          <Input
            autoFocus
            status={error ? "error" : undefined}
            placeholder={t("Vui lòng nhập")}
            aria-label={t("Cách sử dụng khác")}
            value={draft.otherUsage ?? ""}
            onChange={(event) => {
              setDraft((current) => ({ ...current, otherUsage: event.target.value }));
              if (error) setError(null);
            }}
            onPressEnter={commit}
          />
          {error && (
            <p role="alert" className="bd-usage-error">
              <ExclamationCircleOutlined aria-hidden="true" /> {error}
            </p>
          )}
        </div>
      )}

      <div className="bd-usage-footer">
        <Button type="primary" size="small" icon={<SaveOutlined />} onClick={commit}>
          {t("Lưu")}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      classNames={{ root: "bd-usage-popover" }}
      open={open}
      onOpenChange={show}
    >
      {/* Looks like the selects beside it — a placeholder until something is
          picked, a chevron on the right — but opens the checkbox sheet. */}
      <button
        type="button"
        className={["bd-usage-trigger", value.usage === 0 && "bd-usage-trigger--empty", open && "bd-usage-trigger--open"]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="bd-usage-trigger-text">{usageLabel(value)}</span>
        <DownOutlined className="bd-usage-trigger-arrow" aria-hidden="true" />
      </button>
    </Popover>
  );
}
