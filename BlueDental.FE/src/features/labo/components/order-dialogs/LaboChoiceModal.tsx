import { useState } from "react";
import { Button, Input, Modal } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { choiceGroups, matchesChoice, type LaboChoiceItem } from "./laboChoice";
import { LaboChoiceList } from "./LaboChoiceList";

/** The words of one popup: "Chọn dịch vụ Labo", "10 dịch vụ", the search hint and "Chọn dịch vụ". */
export interface LaboChoiceTexts {
  title: string;
  count: string;
  search: string;
  confirm: string;
}

interface Props {
  open: boolean;
  texts: LaboChoiceTexts;
  items: LaboChoiceItem[];
  value: string | undefined;
  /** "Dùng gần đây:" — none and the line is left out. */
  recent?: LaboChoiceItem[];
  onCancel: () => void;
  onPick: (value: string) => void;
}

const ALL = "";

/** The popup's body, rebuilt on every opening so it starts on the row's choice and no filter. */
function ChoiceBody({ texts, items, value, recent = [], onCancel, onPick }: Omit<Props, "open">) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(ALL);
  const [picked, setPicked] = useState(value);
  const groups = choiceGroups(items);
  const shown = items.filter((item) => (group === ALL || item.group === group) && matchesChoice(item, query));
  const pickedLabel = items.find((item) => item.value === picked)?.label;

  const chip = (key: string, label: string, count: number) => (
    <button
      type="button"
      key={key || "all"}
      className={group === key ? "pd-labo-pick-chip pd-labo-pick-chip--on" : "pd-labo-pick-chip"}
      aria-pressed={group === key}
      onClick={() => setGroup(key)}
    >
      {label} <b>{count}</b>
    </button>
  );

  return (
    <>
      <div className="pd-labo-pick-head">
        <Input
          autoFocus
          allowClear
          prefix={<SearchOutlined />}
          placeholder={texts.search}
          aria-label={texts.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {groups.length > 0 && (
          <div className="pd-labo-pick-chips">
            {chip(ALL, t("Labo:Choice:All"), items.length)}
            {groups.map((one) => chip(one.name, one.name, one.count))}
          </div>
        )}
        {recent.length > 0 && (
          <div className="pd-labo-pick-recent">
            <span>{t("Labo:Choice:Recent")}</span>
            {recent.map((item) => (
              <button type="button" key={item.value} onClick={() => setPicked(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <LaboChoiceList items={shown} picked={picked} label={texts.title} onPick={setPicked} onConfirm={onPick} />
      <div className="pd-labo-pick-foot">
        <p>
          {t("Labo:Choice:Picked")} <b>{pickedLabel ?? "—"}</b>
        </p>
        <Button onClick={onCancel}>{t("Common:Cancel")}</Button>
        <Button type="primary" disabled={!picked} onClick={() => picked && onPick(picked)}>
          {texts.confirm}
        </Button>
      </div>
    </>
  );
}

/**
 * «Xem thêm dịch vụ / vật liệu» (P3110 m158, REQ-C5): search blind to case and
 * marks, group chips with their counts, the recent choices, and a one-pick
 * radio list; nothing changes on the form until the footer's button.
 */
export function LaboChoiceModal({ open, ...body }: Props) {
  return (
    <Modal
      open={open}
      onCancel={body.onCancel}
      width="min(720px, calc(100vw - 32px))"
      className="pd-labo-pick"
      title={
        <span className="pd-labo-pick-title">
          {body.texts.title}
          <span className="pd-labo-pick-count">{body.texts.count}</span>
        </span>
      }
      footer={null}
      destroyOnHidden
    >
      <ChoiceBody {...body} />
    </Modal>
  );
}
