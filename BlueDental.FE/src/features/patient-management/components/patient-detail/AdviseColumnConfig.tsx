import { useState } from "react";
import { Button, Popover, Switch, type TooltipProps } from "antd";
import { CloseOutlined, HolderOutlined, SettingOutlined } from "@ant-design/icons";
import { useDragReorder } from "@/hooks/useDragReorder";
import { t } from "@/lib/i18n";
import { moveItem } from "@/utils/array";
import { COLUMN_LABELS, type ColumnSetting } from "./adviseColumns";

type AdjustOverflow = Exclude<TooltipProps["autoAdjustOverflow"], boolean | undefined>;

/**
 * Under the button, as the reference drops it, slid up just enough to stay on
 * screen. antd's default flip put it above a button low in the window with its
 * ✕ cut off past the top, out of reach — the record scrolls as one page now,
 * so the button can sit anywhere. antd reads `shiftY` at runtime
 * (`_util/placements` getOverflowOptions) though its type does not list it.
 */
const DROP_BELOW: AdjustOverflow & { shiftY: boolean } = { shiftY: true };

interface Props {
  settings: ColumnSetting[];
  onSave: (next: ColumnSetting[]) => void;
}

/**
 * "Cột hiển thị" — the panel the reference drops under that button.
 *
 * Its rows drag, so the order of the columns is the user's too, and nothing is
 * applied until "Lưu": the panel edits a draft and hands the whole list over at
 * once. Closing it — by the ✕, or by clicking away — drops the draft.
 */
export function AdviseColumnConfig({ settings, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnSetting[]>(settings);

  const drag = useDragReorder({
    items: draft,
    getKey: (setting) => setting.key,
    enabled: true,
    onCommit: (from, to) => setDraft((current) => moveItem(current, from, to)),
  });

  const toggle = (key: string, on: boolean) =>
    setDraft((current) =>
      current.map((setting) => (setting.key === key ? { ...setting, on } : setting)),
    );

  const handleOpenChange = (next: boolean) => {
    // Opening starts from what is on the table; closing throws the draft away.
    if (next) setDraft(settings);
    setOpen(next);
  };

  const handleSave = () => {
    onSave(drag.items);
    setOpen(false);
  };

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      autoAdjustOverflow={DROP_BELOW}
      open={open}
      onOpenChange={handleOpenChange}
      title={
        <div className="pd-column-head">
          <span>{t("Patient:ColumnConfig")}</span>
          <button
            type="button"
            className="pd-column-close"
            aria-label={t("Common:Close")}
            onClick={() => setOpen(false)}
          >
            <CloseOutlined aria-hidden="true" />
          </button>
        </div>
      }
      content={
        <div className="pd-column-popover">
          <div className="pd-column-list">
            {drag.items.map((setting, index) => (
              <div
                key={setting.key}
                ref={drag.registerRow(setting.key)}
                className={[
                  "pd-column-row",
                  drag.draggingKey === setting.key && "pd-column-row--dragging",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="bd-grip"
                  title={t("Patient:SortHint")}
                  aria-label={t("Patient:SortColumnLabel", t(COLUMN_LABELS[setting.key]))}
                  {...drag.handleProps(setting.key)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" && index > 0) {
                      event.preventDefault();
                      setDraft((current) => moveItem(current, index, index - 1));
                    }
                    if (event.key === "ArrowDown" && index < drag.items.length - 1) {
                      event.preventDefault();
                      setDraft((current) => moveItem(current, index, index + 1));
                    }
                  }}
                >
                  <HolderOutlined aria-hidden="true" />
                </button>
                <span className="pd-column-name">{t(COLUMN_LABELS[setting.key])}</span>
                <Switch
                  size="small"
                  checked={setting.on}
                  aria-label={t(COLUMN_LABELS[setting.key])}
                  onChange={(on) => toggle(setting.key, on)}
                />
              </div>
            ))}
          </div>
          <Button type="primary" block onClick={handleSave}>
            {t("Common:Save")}
          </Button>
        </div>
      }
    >
      <Button icon={<SettingOutlined />}>{t("Patient:VisibleColumns")}</Button>
    </Popover>
  );
}
