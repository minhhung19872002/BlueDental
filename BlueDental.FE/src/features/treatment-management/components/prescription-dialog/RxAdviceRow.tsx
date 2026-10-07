import { Checkbox, Form, Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

/**
 * "Lời dặn" beside "Lưu đơn thuốc mẫu"; ticking the box asks for the
 * template's name, filed into the Đơn thuốc mẫu catalog on Lưu.
 */
export function RxAdviceRow({ saveAsTemplate }: { saveAsTemplate: boolean }) {
  return (
    <div className="rx-advice">
      <Form.Item name="note" className="rx-advice-note">
        <Input
          placeholder={t("Treatment:Prescription:NotePlaceholder")}
          aria-label={t("Treatment:Prescription:NotePlaceholder")}
          maxLength={1000}
        />
      </Form.Item>
      <Form.Item name="saveAsTemplate" valuePropName="checked">
        <Checkbox>{t("Treatment:Prescription:SaveTemplate")}</Checkbox>
      </Form.Item>
      {saveAsTemplate && (
        <FloatingField
          name="templateName"
          label={t("Treatment:Prescription:TemplateName")}
          required
          className="rx-advice-template"
          rules={[{ required: true, whitespace: true, message: t("Treatment:Prescription:TemplateNameRequired") }]}
        >
          <Input maxLength={200} />
        </FloatingField>
      )}
    </div>
  );
}
