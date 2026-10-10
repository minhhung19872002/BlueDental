import { AutoComplete, Form, Input, Select } from "antd";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type CreatableOrgUnitKind } from "../../api/orgChartApi";
import { OrgMembersField } from "./OrgMembersField";
import { OrgUnitKindCards } from "./OrgUnitKindCards";
import { parentFits, type OrgChartIndex } from "./orgChartModel";
import { staffPickerOptions } from "./orgStaffOptions";
import { nameSuggestions, unitFormRules } from "./orgUnitForm";

interface Props {
  index: OrgChartIndex;
  /** The unit being edited; null while creating. */
  selfUnitId: string | null;
  kind: CreatableOrgUnitKind;
  typedName: string;
  headStaffId?: string;
}

/** The fields of "Thêm / Sửa đơn vị", in the order of the BA mockup. */
export function OrgUnitFormFields({ index, selfUnitId, kind, typedName, headStaffId }: Props) {
  const rules = unitFormRules(index, selfUnitId);

  const parentOptions = index.units
    .filter((u) => u.id !== selfUnitId && parentFits(kind, u.kind))
    .map((u) => ({ value: u.id, label: u.kind === ORG_UNIT_KIND.Root ? t("OrgChart:Kind:Root") : u.name }));

  // Anyone may head a unit, a Team bác sĩ included (BA, 2026-10-10).
  const headOptions = staffPickerOptions(index, { selfUnitId });

  return (
    <>
      {!selfUnitId && (
        <Form.Item name="kind" label={t("OrgChart:Field:kind")} className="org-form__wide">
          <OrgUnitKindCards />
        </Form.Item>
      )}
      <Form.Item name="name" label={t("OrgChart:Field:name")} rules={rules.name} className="org-form__wide">
        <AutoComplete options={nameSuggestions(index, typedName, selfUnitId)}>
          <Input maxLength={200} placeholder={t("OrgChart:Placeholder:Name")} />
        </AutoComplete>
      </Form.Item>
      <Form.Item
        name="parentId"
        label={t("OrgChart:Field:parent")}
        rules={rules.parent}
        extra={t("OrgChart:Hint:Parent")}
      >
        <Select options={parentOptions} />
      </Form.Item>
      <Form.Item name="code" label={t("OrgChart:Field:code")} rules={rules.code} extra={t("OrgChart:Hint:Code")}>
        <Input maxLength={32} />
      </Form.Item>
      <Form.Item name="headStaffId" label={t("OrgChart:Field:head")} rules={rules.head} className="org-form__wide">
        <Select showSearch optionFilterProp="label" options={headOptions} placeholder={t("OrgChart:Placeholder:Head")} />
      </Form.Item>
      <Form.Item name="memberIds" label={t("OrgChart:Field:members")} className="org-form__wide">
        <OrgMembersField index={index} selfUnitId={selfUnitId} headStaffId={headStaffId} />
      </Form.Item>
    </>
  );
}
