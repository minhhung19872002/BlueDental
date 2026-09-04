import { Form, Input } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/** Same eight swatches the "Thêm thẻ hồ sơ mới" dialog offers before the custom picker. */
const PRESET_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#64748B",
] as const;

export const DEFAULT_CATEGORY_COLOR = "#3B82F6";

interface Props {
  color: string;
  previewName: string;
  onChange: (color: string) => void;
}

/** Swatch row + preview chip, laid out exactly like the patient-tag dialog. */
export function CategoryColorFields({ color, previewName, onChange }: Props) {
  return (
    <>
      {/* The colour is picked, not typed, so the field holds it rather than rendering a control. */}
      <Form.Item name="colorCode" hidden>
        <Input />
      </Form.Item>

      <div className="bd-dialog-section">
        <p className="bd-dialog-section-title">{t("Mã màu")}</p>
        <div className="bd-cat-inline">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={t("Chọn màu {0}", preset)}
              aria-pressed={color.toUpperCase() === preset}
              onClick={() => onChange(preset)}
              style={{ backgroundColor: preset }}
              className={cn("bd-tag-color", color.toUpperCase() === preset && "bd-tag-color--picked")}
            />
          ))}

          <div className="bd-rel">
            <span aria-hidden="true" className="bd-tag-swatch">
              <BgColorsOutlined />
            </span>
            <input
              type="color"
              aria-label={t("Chọn màu tuỳ chỉnh")}
              value={color}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="bd-color-input"
            />
          </div>
        </div>
      </div>

      <div className="bd-tag-preview">
        <p className="bd-cat-hint">{t("Xem trước")}</p>
        <span style={{ backgroundColor: color }} className="bd-tag-chip">
          {previewName || t("Danh mục mới")}
        </span>
      </div>
    </>
  );
}
