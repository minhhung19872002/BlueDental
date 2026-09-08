import { useState } from "react";
import { PenLine, Save, Stethoscope } from "lucide-react";
import { RichTextField } from "@/components/RichTextField";
import { t } from "@/lib/i18n";
import { normalizeEditorHtml, type DiagnosisDoctorItem } from "./quoteModel";

interface Props {
  item: DiagnosisDoctorItem;
  onChange: (html: string) => void;
}

/**
 * One doctor's block on the diagnosis sheet: who diagnosed, what, on which
 * teeth, and the explanation — editable in place before printing. The edit
 * lives only in this preview; nothing is written back.
 */
export function DiagnosisDoctorCard({ item, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.explanationHtml);

  const startEdit = () => {
    setDraft(item.explanationHtml);
    setEditing(true);
  };
  const save = () => {
    onChange(normalizeEditorHtml(draft));
    setEditing(false);
  };

  return (
    <div className="pq-dx__doctor">
      <div className="pq-dx__doctor-head">
        <span className="pq-dx__doctor-name">
          <Stethoscope size={12} className="pq-print-hidden" />
          {t("Bác sĩ")}: <b>{item.doctor}</b>
        </span>
        <button
          type="button"
          className={
            editing ? "pq-dx__edit pq-dx__edit--on pq-print-hidden" : "pq-dx__edit pq-print-hidden"
          }
          onClick={editing ? () => setEditing(false) : startEdit}
        >
          <PenLine size={11} />
          {editing ? t("Đang sửa") : t("Sửa")}
        </button>
      </div>
      <p className="pq-dx__doctor-dx">
        <b>{t("Chẩn đoán")}: </b>
        <span>{item.diagnosisLabel.toUpperCase()}</span>
        {item.teeth && <span className="pq-dx__teeth">{t("Răng {0}", item.teeth)}</span>}
      </p>
      <p className="pq-dx__content-label">{t("Nội dung chẩn đoán:")}</p>
      {editing ? (
        <div className="pq-dx__editor pq-print-hidden">
          <RichTextField value={draft} onChange={setDraft} />
          <div className="pq-dx__editor-actions">
            <button
              type="button"
              className="tp-btn tp-btn--outline"
              onClick={() => setEditing(false)}
            >
              {t("Hủy")}
            </button>
            <button type="button" className="tp-btn tp-btn--primary" onClick={save}>
              <Save size={14} />
              {t("Lưu lại")}
            </button>
          </div>
        </div>
      ) : (
        // The HTML is what Quill produced in this same preview, or the
        // escaped slip note — nothing arrives from a server as markup.
        <div dangerouslySetInnerHTML={{ __html: item.explanationHtml || "<p>-</p>" }} />
      )}
    </div>
  );
}
