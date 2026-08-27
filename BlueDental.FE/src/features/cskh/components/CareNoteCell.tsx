import { useEffect, useState } from "react";
import { Input } from "antd";
import { t } from "@/lib/i18n";

interface CareNoteCellProps {
  value: string | null;
  onSave: (note: string) => void;
}

/**
 * The inline Ghi chú textbox: edits locally and saves on blur — the reference
 * fires the same full-object PUT the care-result dialog uses, status kept.
 */
export function CareNoteCell({ value, onSave }: CareNoteCellProps) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const handleBlur = () => {
    if (draft !== (value ?? "")) onSave(draft);
  };

  return (
    <Input.TextArea
      className="cskh-note-input"
      placeholder={t("Nhập ghi chú")}
      autoSize={{ minRows: 2, maxRows: 4 }}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
    />
  );
}
