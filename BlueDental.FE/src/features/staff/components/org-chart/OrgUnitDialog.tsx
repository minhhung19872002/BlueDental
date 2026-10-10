import { useEffect, useRef, useState } from "react";
import { Alert, Button, Form } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { AppDialog } from "@/components/AppDialog";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  ORG_UNIT_KIND,
  useOrgUnitNextCode,
  type CreateOrgUnitInput,
  type OrgUnitDto,
  type OrgUnitInput,
} from "../../api/orgChartApi";
import { erroredFields, OrgFormErrorSummary, type OrgFormField } from "./OrgFormErrorSummary";
import { OrgScopePreview } from "./OrgScopePreview";
import { OrgUnitFormFields } from "./OrgUnitFormFields";
import { parentFits, type OrgChartIndex } from "./orgChartModel";
import { initialUnitValues, toUnitInput, type OrgUnitFormValues } from "./orgUnitForm";

interface Props {
  open: boolean;
  /** The unit being edited; null adds a new one. */
  unit: OrgUnitDto | null;
  index: OrgChartIndex;
  saving: boolean;
  /** The server's refusal, shown in the banner. */
  error: unknown;
  /** Absent when the account may not delete units. */
  onDelete?: (unit: OrgUnitDto) => void;
  onSubmit: (input: CreateOrgUnitInput | OrgUnitInput) => void;
  onClose: () => void;
}

/**
 * "Thêm đơn vị mới" / "Sửa đơn vị". The client repeats the server's checks so
 * the user sees them while typing; whatever the server still refuses lands in
 * the banner and the dialog stays open.
 */
export function OrgUnitDialog({ open, unit, index, saving, error, onDelete, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<OrgUnitFormValues>();
  const selfUnitId = unit?.id ?? null;
  const kind = Form.useWatch("kind", form) ?? ORG_UNIT_KIND.DoctorTeam;
  const typedName = Form.useWatch("name", form) ?? "";
  const headStaffId = Form.useWatch("headStaffId", form);
  const memberIds = Form.useWatch("memberIds", form) ?? [];
  const lastHead = useRef<string | undefined>(undefined);
  const [invalid, setInvalid] = useState<OrgFormField[]>([]);
  useEffect(() => {
    if (!open) return;
    lastHead.current = unit?.headStaffId ?? undefined;
    setInvalid([]);
  }, [open, unit]);

  // "Mã đơn vị: tự sinh, có thể sửa" — fill the next code until the user types one.
  const nextCode = useOrgUnitNextCode(kind, open && !unit);
  useEffect(() => {
    if (!unit && nextCode.data && !form.isFieldTouched("code")) form.setFieldValue("code", nextCode.data);
  }, [form, unit, nextCode.data]);

  const handleValuesChange = (changed: Partial<OrgUnitFormValues>, all: OrgUnitFormValues) => {
    if (changed.kind !== undefined) {
      const parent = all.parentId ? index.byId.get(all.parentId) : undefined;
      if (!parent || !parentFits(changed.kind, parent.kind)) form.setFieldValue("parentId", index.root?.id);
    }
    if ("headStaffId" in changed) {
      // The replaced head stays in the unit as a member; the new one leaves the member list.
      const previous = lastHead.current;
      const members = all.memberIds.filter((id) => id !== changed.headStaffId);
      form.setFieldValue("memberIds", previous && previous !== changed.headStaffId ? [...members, previous] : members);
      lastHead.current = changed.headStaffId;
    }
  };

  const handleJump = (field: OrgFormField) => form.scrollToField(field, { block: "center", focus: true });

  const deleteButton = unit && onDelete && (
    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onDelete(unit)}>
      {t("OrgChart:Action:Delete")}
    </Button>
  );

  return (
    <AppDialog
      open={open}
      title={t(unit ? "OrgChart:Dialog:EditTitle" : "OrgChart:Dialog:CreateTitle")}
      subtitle={unit ? `${unit.code} · ${unit.name}` : t("OrgChart:Dialog:CreateSubtitle")}
      width={720}
      className="org-unit-dialog"
      canSave={invalid.length === 0}
      saving={saving}
      saveLabel={t("OrgChart:Dialog:Save")}
      cancelLabel={t("Common:Cancel")}
      footerLeft={deleteButton}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <OrgFormErrorSummary fields={invalid} onJump={handleJump} />
      {Boolean(error) && <Alert type="error" showIcon className="org-form__error" message={extractApiError(error)} />}
      {/* The dialog is destroyed on close, so each opening mounts the form afresh. */}
      <Form
        form={form}
        layout="vertical"
        className="org-form"
        initialValues={initialUnitValues(unit, index)}
        preserve={false}
        onValuesChange={handleValuesChange}
        onFieldsChange={(_, all) => setInvalid(erroredFields(all))}
        onFinish={(values) => onSubmit(toUnitInput(values))}
      >
        <OrgUnitFormFields
          index={index}
          selfUnitId={selfUnitId}
          kind={kind}
          typedName={typedName}
          headStaffId={headStaffId}
        />
      </Form>
      <OrgScopePreview
        index={index}
        kind={kind}
        selfUnitId={selfUnitId}
        headStaffId={headStaffId}
        memberIds={memberIds}
      />
    </AppDialog>
  );
}
