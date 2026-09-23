import { Form } from "antd";
import { t } from "@/lib/i18n";
import { ChipStrip } from "./ChipStrip";
import { requiredRule, useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

/** Lựa chọn dịch vụ → Vật liệu: the material waits for a service group. */
export function LaboMaterialStrips({ form }: { form: LaboOrderForm }) {
  const { options } = form;
  const serviceGroupId = useLaboValue(form.form, "serviceGroupId");
  return (
    <>
      <Form.Item name="serviceGroupId" rules={requiredRule(t("Patient:Labo:RequiredService"))}>
        <ChipStrip
          label={t("Patient:Quote:ServiceSelection")}
          options={options.services}
          empty={t("Common:NoData")}
          // Runs after the Form.Item stored the group: a new group (or none), a fresh material.
          onChange={() => form.form.setFieldsValue({ materialId: undefined })}
        />
      </Form.Item>
      <Form.Item name="materialId" rules={requiredRule(t("Patient:Misc:RequiredMaterial"))}>
        <ChipStrip
          label={t("Patient:Labo:Material")}
          options={options.materials}
          empty={serviceGroupId ? t("Patient:Labo:NoMaterial") : t("Patient:Stage:SelectServiceFirst")}
          dimmed={!serviceGroupId}
        />
      </Form.Item>
    </>
  );
}
