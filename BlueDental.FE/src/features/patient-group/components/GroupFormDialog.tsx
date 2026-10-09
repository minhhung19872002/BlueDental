import { Form, Input, Segmented } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import {
  GROUP_KIND,
  type GroupKind,
  type MemberDraft,
  type PatientGroupDetailDto,
  type SavePatientGroupInput,
} from "../types";
import { GroupMembersEditor } from "./GroupMembersEditor";

interface FormValues {
  name: string;
  kind: GroupKind;
  members: MemberDraft[];
  sharedMedicalNote?: string;
  note?: string;
}

interface Props {
  /** null closed; "new" (optionally seeded with one member) or a group to edit. */
  editing: PatientGroupDetailDto | { seed: MemberDraft | null } | null;
  saving: boolean;
  onSubmit: (input: SavePatientGroupInput) => void;
  onClose: () => void;
}

const initialOf = (editing: NonNullable<Props["editing"]>): FormValues =>
  "seed" in editing
    ? { name: "", kind: GROUP_KIND.Family, members: editing.seed ? [editing.seed] : [] }
    : {
        name: editing.name,
        kind: editing.kind,
        members: editing.members.map((m) => ({ patientId: m.patientId, label: `[${m.patientCode}] - ${m.fullName}`, role: m.role })),
        sharedMedicalNote: editing.sharedMedicalNote ?? undefined,
        note: editing.note ?? undefined,
      };

/**
 * "Tạo / Cập nhật hồ sơ nhóm" — a family (one per record) or another group,
 * its members with one Chủ hộ / Trưởng nhóm, and the medical background the
 * members share.
 */
export function GroupFormDialog({ editing, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const kind = Form.useWatch("kind", form) ?? GROUP_KIND.Family;
  const isNew = editing !== null && "seed" in editing;

  const handleFinish = (values: FormValues) =>
    onSubmit({
      name: values.name.trim(),
      kind: values.kind,
      note: values.note?.trim() || null,
      sharedMedicalNote: values.sharedMedicalNote?.trim() || null,
      members: values.members.map((m) => ({ patientId: m.patientId, role: m.role })),
    });

  return (
    <AppDialog
      open={editing !== null}
      title={t(isNew ? "PatientGroup:CreateTitle" : "PatientGroup:EditTitle")}
      width={720}
      className="pg-dialog"
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {editing !== null && (
        <Form<FormValues> form={form} layout="vertical" preserve={false} initialValues={initialOf(editing)} onFinish={handleFinish}>
          <Form.Item name="kind" label={t("PatientGroup:Field:Kind")}>
            <Segmented<GroupKind>
              options={[
                { value: GROUP_KIND.Family, label: t("PatientGroup:Kind:Family") },
                { value: GROUP_KIND.Other, label: t("PatientGroup:Kind:Other") },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("PatientGroup:Field:Name")}
            rules={[{ required: true, whitespace: true, message: t("PatientGroup:Validation:Name") }]}
          >
            <Input maxLength={150} placeholder={t(kind === GROUP_KIND.Family ? "PatientGroup:NameHintFamily" : "PatientGroup:NameHintOther")} />
          </Form.Item>
          <Form.Item
            name="members"
            label={t("PatientGroup:Field:Members")}
            extra={t(kind === GROUP_KIND.Family ? "PatientGroup:MembersHintFamily" : "PatientGroup:MembersHintOther")}
            rules={[{ validator: (_, v: MemberDraft[]) => (v?.length ? Promise.resolve() : Promise.reject(new Error(t("PatientGroup:Validation:Members")))) }]}
          >
            <GroupMembersEditor kind={kind} />
          </Form.Item>
          <Form.Item name="sharedMedicalNote" label={t("PatientGroup:Field:SharedMedicalNote")} extra={t("PatientGroup:SharedMedicalHint")}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="note" label={t("PatientGroup:Field:Note")}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
