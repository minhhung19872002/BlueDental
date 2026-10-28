import { useState } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import { ChipStrip } from "./ChipStrip";
import { requiredRule, useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

/** Lựa chọn dịch vụ → Vật liệu: the material waits for a service group. */
export function LaboMaterialStrips({ form }: { form: LaboOrderForm }) {
  const { options } = form;
  const serviceGroupId = useLaboValue(form.form, "serviceGroupId");
  const [materialQuery, setMaterialQuery] = useState("");

  const handleServiceGroupChange = () => {
    form.form.setFieldsValue({ materialId: undefined });
    setMaterialQuery("");
  };

  return (
    <>
      <Form.Item name="serviceGroupId" rules={requiredRule(t("Patient:Labo:RequiredService"))}>
        <ChipStrip
          label={t("Patient:Quote:ServiceSelection")}
          options={options.services}
          empty={t("Common:NoData")}
          // Runs after the Form.Item stored the group: a new group (or none), a fresh material and search.
          onChange={handleServiceGroupChange}
        />
      </Form.Item>
      <Form.Item name="materialId" rules={requiredRule(t("Patient:Misc:RequiredMaterial"))}>
        <ChipStrip
          label={t("Patient:Labo:Material")}
          options={options.materials}
          empty={serviceGroupId ? t("Patient:Labo:NoMaterial") : t("Patient:Stage:SelectServiceFirst")}
          dimmed={!serviceGroupId}
          search={{
            query: materialQuery,
            onQuery: setMaterialQuery,
            placeholder: t("Labo:Material:SearchMaterial"),
            noMatch: t("Patient:Labo:NoMaterialMatch"),
          }}
        />
      </Form.Item>
    </>
  );
}
