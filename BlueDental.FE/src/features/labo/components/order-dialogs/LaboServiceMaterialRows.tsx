import { useMemo } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboMaterialOption, LaboServiceOption } from "@/hooks/useLaboPickers";
import type { LaboChoiceItem } from "./laboChoice";
import { LaboChoiceRow } from "./LaboChoiceRow";
import { requiredRule, useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";
import { useRecentLaboServices } from "./useRecentLaboServices";

/** Each service with its materials counted and searchable (m158: "7 vật liệu", "…hoặc vật liệu"). */
function serviceItems(services: LaboServiceOption[], materials: LaboMaterialOption[]): LaboChoiceItem[] {
  return services.map((service) => {
    const own = materials.filter((material) => material.serviceId === service.value);
    return {
      ...service,
      extra: t("Labo:Choice:MaterialCount", own.length),
      keywords: own.map((material) => material.label),
    };
  });
}

/**
 * Dịch vụ → Vật liệu on the Đặt hàng tab (P3110 REQ-C4/C5): one service, then
 * one of its materials. A new service lets go of a material it does not offer,
 * and the material row and popup list only the service's own.
 */
export function LaboServiceMaterialRows({ form }: { form: LaboOrderForm }) {
  const { services, materials } = form.options;
  const serviceId = useLaboValue(form.form, "serviceGroupId");
  const { recent, remember } = useRecentLaboServices();

  const allServices = useMemo(() => serviceItems(services, materials), [services, materials]);
  const ownMaterials = useMemo(
    () => materials.filter((material) => material.serviceId === serviceId),
    [materials, serviceId],
  );
  const recentServices = recent.flatMap((id) => allServices.filter((service) => service.value === id));

  // Runs after the Form.Item stored the service.
  const handleServiceChange = (picked: string) => {
    remember(picked);
    const materialId = form.form.getFieldValue("materialId");
    if (!materials.some((material) => material.value === materialId && material.serviceId === picked)) {
      form.form.setFieldsValue({ materialId: undefined });
    }
  };

  return (
    <>
      <Form.Item name="serviceGroupId" rules={requiredRule(t("Patient:Labo:RequiredService"))}>
        <LaboChoiceRow
          text={{ label: t("Labo:Choice:Service"), empty: t("Common:NoData") }}
          items={allServices}
          disabled={form.readOnly}
          more={{
            label: t("Labo:Choice:MoreServices"),
            recent: recentServices,
            texts: {
              title: t("Labo:Choice:ServiceTitle"),
              count: t("Labo:Choice:ServiceCount", allServices.length),
              search: t("Labo:Choice:ServiceSearch"),
              confirm: t("Labo:Choice:ServiceConfirm"),
            },
          }}
          onChange={handleServiceChange}
        />
      </Form.Item>
      <Form.Item name="materialId" rules={requiredRule(t("Patient:Misc:RequiredMaterial"))}>
        <LaboChoiceRow
          text={{
            label: t("Patient:Labo:Material"),
            empty: serviceId ? t("Patient:Labo:NoMaterial") : t("Patient:Stage:SelectServiceFirst"),
          }}
          items={ownMaterials}
          disabled={form.readOnly}
          more={{
            label: t("Labo:Choice:MoreMaterials"),
            texts: {
              title: t("Labo:Choice:MaterialTitle"),
              count: t("Labo:Choice:MaterialCount", ownMaterials.length),
              search: t("Labo:Choice:MaterialSearch"),
              confirm: t("Labo:Choice:MaterialConfirm"),
            },
          }}
        />
      </Form.Item>
    </>
  );
}
