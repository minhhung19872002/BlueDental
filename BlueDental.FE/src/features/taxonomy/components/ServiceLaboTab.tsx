import { Form, Select } from "antd";
import { CloseOutlined, InfoCircleOutlined, SearchOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { t } from "@/lib/i18n";

interface Props {
  options: PickerOption[];
  loading: boolean;
}

/**
 * Labo tab: which suppliers a labo slip for this service may be sent to. The
 * picks are a form field (`laboSupplierIds`) so the dialog saves them with
 * everything else; an empty pick means every supplier, as the note says.
 * The box only shows a count; the picks themselves sit under it as pills.
 */
export function ServiceLaboTab({ options, loading }: Props) {
  const form = Form.useFormInstance();
  const picked = Form.useWatch<string[]>("laboSupplierIds", form) ?? [];
  const chips = picked.flatMap((id) => options.filter((option) => option.value === id));

  const remove = (id: string) =>
    form.setFieldValue(
      "laboSupplierIds",
      picked.filter((value) => value !== id),
    );

  return (
    <div className="bd-labo-tab">
      <FloatingField name="laboSupplierIds" label={t("Taxonomy:Service:LaboSupplierLabel")}>
        <Select
          mode="multiple"
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loading}
          options={options}
          prefix={<SearchOutlined />}
          // The reference shows a count, not a row of tags.
          maxTagCount={0}
          maxTagPlaceholder={(omitted) => t("Taxonomy:Service:LaboSelectedCount", omitted.length)}
        />
      </FloatingField>
      {chips.length > 0 && (
        <div className="bd-labo-chips">
          {chips.map((chip) => (
            <span key={chip.value} className="bd-labo-chip" title={chip.label}>
              <span className="bd-labo-chip__text">{chip.label}</span>
              <button
                type="button"
                className="bd-labo-chip__remove"
                aria-label={t("Taxonomy:Service:LaboRemoveAria")}
                onClick={() => remove(chip.value)}
              >
                <CloseOutlined />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="bd-labo-hint">
        <InfoCircleOutlined aria-hidden />
        <span>{t("Taxonomy:Service:LaboHint")}</span>
      </p>
    </div>
  );
}
