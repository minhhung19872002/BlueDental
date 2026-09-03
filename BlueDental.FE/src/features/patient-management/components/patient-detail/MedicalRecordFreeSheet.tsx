import type { CSSProperties } from "react";
import { Select } from "antd";
import { t } from "@/lib/i18n";

/**
 * A plain sheet for the forms whose printed layout BlueDental does not have.
 *
 * Eight of the nine forms in "Mục lục bệnh án" could only be seen on the
 * reference by pressing "Thêm", which writes — so their layouts were never
 * observed and are not reproduced here. What this gives instead is an honest
 * A4 page of the clinic's own: the form's title, and a body the clinic writes
 * in, which may be started from one of its own "Bệnh án mẫu" templates.
 *
 * The one form that *is* drawn to the reference's layout is
 * {@link MedicalRecordSheet}, in Danh mục.
 */

/** A4 at 96dpi, the same paper the printed sheet uses. */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1053;

interface Props {
  title: string;
  value: string;
  onChange: (next: string) => void;
  /** "Bệnh án mẫu" entries the clinic may start this sheet from. */
  templates: { id: string; name: string; content: string | null }[];
  /** 1 = 100%, driven by the bar's zoom control. */
  zoom: number;
  readOnly?: boolean;
}

export function MedicalRecordFreeSheet({
  title,
  value,
  onChange,
  templates,
  zoom,
  readOnly,
}: Props) {
  return (
    <div
      className="bd-a4-viewport pd-a4-free"
      style={
        {
          width: PAGE_WIDTH * zoom + 34,
          "--sheet-zoom": zoom,
        } as CSSProperties
      }
    >
      <div
        className="bd-a4-page bd-a4-center pd-a4-free-page"
        style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT }}
      >
        <h3 className="pd-a4-free-title">{title.toUpperCase()}</h3>

        {!readOnly && templates.length > 0 && (
          <div className="pd-a4-free-tools">
            <span>{t("Bắt đầu từ mẫu")}:</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t("Chọn bệnh án mẫu")}
              aria-label={t("Chọn bệnh án mẫu")}
              popupMatchSelectWidth={false}
              options={templates.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(id) => {
                const picked = templates.find((item) => item.id === id);
                if (picked?.content) onChange(picked.content);
              }}
            />
          </div>
        )}

        <textarea
          className="pd-a4-free-body"
          aria-label={title}
          readOnly={readOnly}
          placeholder={t("Nhập nội dung bệnh án…")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
