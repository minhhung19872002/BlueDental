import { Form, Select } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import type { OrgChartIndex } from "./orgChartModel";
import { staffPickerOptions } from "./orgStaffOptions";
import { headConflictRule } from "./orgUnitForm";

interface FormValues {
  headStaffId?: string;
}

interface Props {
  open: boolean;
  index: OrgChartIndex;
  saving: boolean;
  onSubmit: (headStaffId: string | null) => void;
  onClose: () => void;
}

/** "Đổi người đứng đầu" of the root — the one change the first branch allows (BA). */
export function OrgRootHeadDialog({ open, index, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const rootId = index.root?.id ?? null;
  // The root may stay without a head, so only the "heads another unit" check applies.
  const headRules = [headConflictRule(index, rootId)];

  return (
    <AppDialog
      open={open}
      title={t("OrgChart:Action:ChangeRootHead")}
      subtitle={t("OrgChart:Kind:Root")}
      width={520}
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        className="org-form org-form--single"
        initialValues={{ headStaffId: index.root?.headStaffId ?? undefined }}
        preserve={false}
        onFinish={(values) => onSubmit(values.headStaffId ?? null)}
      >
        <Form.Item name="headStaffId" label={t("OrgChart:Detail:Leader")} rules={headRules}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("OrgChart:Placeholder:Head")}
            options={staffPickerOptions(index, { selfUnitId: rootId })}
          />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
