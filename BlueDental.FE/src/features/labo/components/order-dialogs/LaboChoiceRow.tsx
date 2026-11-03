import { useState } from "react";
import { Form } from "antd";
import { CheckOutlined, RightOutlined } from "@ant-design/icons";
import { shownChoices, LABO_ROW_CHIPS, type LaboChoiceItem } from "./laboChoice";
import { LaboChoiceModal, type LaboChoiceTexts } from "./LaboChoiceModal";
import "./labo-order-rows.css";

/** "Dịch vụ" and the dashed pill shown in place of an empty list. */
interface RowTexts {
  label: string;
  empty: string;
}

/** «Xem thêm dịch vụ ›» and the popup it opens. */
interface MoreChoices {
  label: string;
  texts: LaboChoiceTexts;
  recent?: LaboChoiceItem[];
}

interface Props {
  id?: string;
  text: RowTexts;
  items: LaboChoiceItem[];
  value?: string;
  more: MoreChoices;
  /** A sent order: only the choice is shown. */
  disabled?: boolean;
  onChange?: (value: string) => void;
}

/**
 * "Dịch vụ *" / "Vật liệu *" on the Đặt hàng tab (P3110 m134, REQ-C4): three
 * chips, the chosen one filled with "✓", and an outlined «Xem thêm» pill that
 * opens the popup when the list holds more. A form control (value/onChange),
 * so a Form.Item carries its rule and the label turns red with it — a choice
 * made in the popup goes through the same onChange.
 */
export function LaboChoiceRow({ id, text, items, value, more, disabled, onChange }: Props) {
  const { status } = Form.Item.useStatus();
  const [open, setOpen] = useState(false);
  const chips = disabled ? items.filter((item) => item.value === value) : shownChoices(items, value);
  const className = ["pd-labo-choice", status === "error" && "pd-labo-choice--error"].filter(Boolean).join(" ");

  const handlePick = (picked: string) => {
    setOpen(false);
    if (picked !== value) onChange?.(picked);
  };

  return (
    <div id={id} className={className}>
      <p className="pd-labo-choice-label">
        {text.label}
        <span className="floating-field-required">*</span>
      </p>
      <div className="pd-labo-choice-chips">
        {chips.length === 0 && <span className="pd-labo-emptypill">{text.empty}</span>}
        {chips.map((item) => {
          const chosen = item.value === value;
          return (
            <button
              type="button"
              key={item.value}
              className={chosen ? "pd-labo-choice-chip pd-labo-choice-chip--on" : "pd-labo-choice-chip"}
              aria-pressed={chosen}
              disabled={disabled}
              onClick={() => handlePick(item.value)}
            >
              {chosen && <CheckOutlined />}
              {item.label}
            </button>
          );
        })}
        {!disabled && items.length > LABO_ROW_CHIPS && (
          <button type="button" className="pd-labo-choice-more" onClick={() => setOpen(true)}>
            {more.label}
            <RightOutlined />
          </button>
        )}
      </div>
      {/* A status of its own: a missing choice reddens the row, not the popup's search box. */}
      <Form.Item noStyle validateStatus="">
        <LaboChoiceModal
          open={open}
          texts={more.texts}
          items={items}
          value={value}
          recent={more.recent}
          onCancel={() => setOpen(false)}
          onPick={handlePick}
        />
      </Form.Item>
    </div>
  );
}
