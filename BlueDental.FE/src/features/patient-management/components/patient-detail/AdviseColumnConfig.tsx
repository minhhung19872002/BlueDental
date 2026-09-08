import { useState } from "react";
import { Button, Popover, Switch } from "antd";
import { CloseOutlined, HolderOutlined, SettingOutlined } from "@ant-design/icons";
import { useDragReorder } from "@/hooks/useDragReorder";
import { t } from "@/lib/i18n";
import { moveItem } from "@/utils/array";
import { COLUMN_LABELS, type ColumnSetting } from "./adviseColumns";

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
      open={open}
      onOpenChange={handleOpenChange}
      title={
        <div className="pd-column-head">
          <span>{t("Cấu hình cột")}</span>
          <button
            type="button"
            className="pd-column-close"
            aria-label={t("Đóng")}
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
                  title={t("Kéo, hoặc dùng phím mũi tên lên/xuống, để sắp xếp")}
                  aria-label={t("Sắp xếp {0}", t(COLUMN_LABELS[setting.key]))}
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
            {t("Lưu")}
          </Button>
        </div>
      }
    >
      <Button icon={<SettingOutlined />}>{t("Cột hiển thị")}</Button>
    </Popover>
  );
}
