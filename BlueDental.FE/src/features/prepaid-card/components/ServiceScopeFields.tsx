import { Form, Select } from "antd";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useServiceGroupOptions } from "@/hooks/useServiceGroupOptions";
import { t } from "@/lib/i18n";

/**
 * "Dịch vụ, nhóm dịch vụ được sử dụng thẻ". Services and groups are kept apart
 * so a group keeps covering services added to it later. Both empty = any
 * service. Lives inside a Form with fields `serviceIds` and `serviceGroupIds`.
 */
export function ServiceScopeFields() {
  const services = useCatalogOptions(CATALOG_GROUP.CareService);
  const groups = useServiceGroupOptions();

  return (
    <>
      <Form.Item
        name="serviceGroupIds"
        label={t("PrepaidCard:Field:ServiceGroups")}
        extra={t("PrepaidCard:Field:ScopeHint")}
      >
        <Select
          mode="multiple"
          allowClear
          loading={groups.isLoading}
          optionFilterProp="label"
          placeholder={t("PrepaidCard:Scope:AnyGroup")}
          options={groups.data ?? []}
        />
      </Form.Item>
      <Form.Item name="serviceIds" label={t("PrepaidCard:Field:Services")}>
        <Select
          mode="multiple"
          allowClear
          loading={services.isLoading}
          optionFilterProp="label"
          placeholder={t("PrepaidCard:Scope:AnyService")}
          options={(services.data ?? []).map((service) => ({
            value: service.id,
            label: service.taxonomyName ? `${service.name} (${service.taxonomyName})` : service.name,
          }))}
        />
      </Form.Item>
    </>
  );
}

/** "Mọi dịch vụ" or "2 nhóm · 3 dịch vụ" — the scope in one line. */
export function scopeSummary(scope: { serviceIds: string[]; serviceGroupIds: string[] }): string {
  if (scope.serviceIds.length === 0 && scope.serviceGroupIds.length === 0) return t("PrepaidCard:Scope:All");
  return t("PrepaidCard:Scope:Counts", scope.serviceGroupIds.length, scope.serviceIds.length);
}
