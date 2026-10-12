import { Form, Input, Select } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { PatientSearchSelect } from "@/components/SearchSelect";
import type { PatientRelationRow } from "@/hooks/usePatientFamily";
import { t } from "@/lib/i18n";
import { relationOptions, type PatientRelationType } from "@/utils/patientRelation";
import type { RelationInput } from "../../../api/familyApi";

interface FormValues {
  relatedPatientId?: string;
  type?: PatientRelationType;
  note?: string;
}

interface Props {
  /**
   * null closed, "new" to add, a row to edit (its record cannot change), or a
   * row with no relation yet — a family-group member or legal guardian — to
   * declare one for that person.
   */
  editing: PatientRelationRow | "new" | null;
  patientId: string;
  patientName: string;
  saving: boolean;
  onSubmit: (input: RelationInput) => void;
  onClose: () => void;
}

/**
 * "Thêm mối quan hệ" — another record of the clinic and what it is to this
 * patient. Declared once; the other record shows the inverse by itself.
 */
export function RelationDialog({ editing, patientId, patientName, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const isNew = editing === "new" || editing?.id === null;

  const handleFinish = (values: FormValues) =>
    onSubmit({
      relatedPatientId: values.relatedPatientId ?? "",
      type: values.type as PatientRelationType,
      note: values.note?.trim() || null,
    });

  return (
    <AppDialog
      open={editing !== null}
      title={t(isNew ? "PatientRelation:AddTitle" : "PatientRelation:EditTitle")}
      subtitle={t("PatientRelation:DialogHint", patientName)}
      width={560}
      className="pf-dialog"
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {editing !== null && (
        <Form<FormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={
            editing === "new"
              ? {}
              : { relatedPatientId: editing.relatedPatientId, type: editing.type ?? undefined, note: editing.note ?? undefined }
          }
          onFinish={handleFinish}
        >
          <Form.Item
            name="relatedPatientId"
            label={t("PatientRelation:Field:Patient")}
            rules={[
              { required: true, message: t("PatientRelation:Validation:Patient") },
              {
                validator: (_, value) =>
                  value === patientId ? Promise.reject(new Error(t("PatientRelation:Validation:Self"))) : Promise.resolve(),
              },
            ]}
          >
            <PatientSearchSelect placeholder={t("PatientRelation:Field:Patient")} disabled={editing !== "new"} />
          </Form.Item>
          <Form.Item
            name="type"
            label={t("PatientRelation:Field:Type", patientName)}
            rules={[{ required: true, message: t("PatientRelation:Validation:Type") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              listHeight={400}
              options={relationOptions()}
              placeholder={t("PatientRelation:Field:TypePlaceholder")}
            />
          </Form.Item>
          <Form.Item name="note" label={t("PatientRelation:Field:Note")}>
            <Input maxLength={200} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
