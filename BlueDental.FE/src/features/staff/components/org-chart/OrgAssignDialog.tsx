import { Form, Select } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND } from "../../api/orgChartApi";
import { OrgMembersField } from "./OrgMembersField";
import type { OrgChartIndex } from "./orgChartModel";

interface FormValues {
  orgUnitId?: string;
  staffIds: string[];
}

interface Props {
  open: boolean;
  /** "Thêm thành viên" on a unit fixes it; the unassigned strip leaves it to pick. */
  unitId: string | null;
  index: OrgChartIndex;
  saving: boolean;
  onSubmit: (orgUnitId: string, staffIds: string[]) => void;
  onClose: () => void;
}

/** "Thêm thành viên" / "Phân vào đơn vị": move people into one unit, their old unit losing them. */
export function OrgAssignDialog({ open, unitId, index, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const targetId = Form.useWatch("orgUnitId", form) ?? unitId ?? undefined;
  const staffIds = Form.useWatch("staffIds", form) ?? [];
  const target = targetId ? index.byId.get(targetId) : undefined;

  const unitOptions = index.units.map((u) => ({
    value: u.id,
    label: u.kind === ORG_UNIT_KIND.Root ? t("OrgChart:Kind:Root") : u.name,
  }));

  return (
    <AppDialog
      open={open}
      title={t(unitId ? "OrgChart:Action:AddMembers" : "OrgChart:Action:Assign")}
      subtitle={target ? (target.kind === ORG_UNIT_KIND.Root ? t("OrgChart:Kind:Root") : target.name) : undefined}
      width={600}
      canSave={Boolean(targetId) && staffIds.length > 0}
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        className="org-form org-form--single"
        initialValues={{ orgUnitId: unitId ?? undefined, staffIds: [] }}
        preserve={false}
        onFinish={(values) => onSubmit(values.orgUnitId!, values.staffIds)}
      >
        <Form.Item
          name="orgUnitId"
          label={t("OrgChart:Assign:Unit")}
          rules={[{ required: true, message: t("OrgChart:Required:Unit") }]}
          hidden={Boolean(unitId)}
        >
          <Select showSearch optionFilterProp="label" options={unitOptions} />
        </Form.Item>
        <Form.Item name="staffIds" label={t("OrgChart:Assign:People")}>
          <OrgMembersField
            index={index}
            selfUnitId={targetId ?? null}
            excludeIds={target?.members.map((m) => m.id)}
          />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
