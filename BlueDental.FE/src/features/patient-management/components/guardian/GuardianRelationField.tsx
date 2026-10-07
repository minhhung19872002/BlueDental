import { Form, Input, Select } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { GUARDIAN_RELATION, type GuardianRelationCode } from "../../types/patient";
import { PROOF_TYPE_OPTIONS, RELATION_OPTIONS } from "../../utils/guardian";
import { GuardianProofUpload } from "./GuardianProofUpload";

interface PillsProps {
  value?: GuardianRelationCode;
  onChange?: (value: GuardianRelationCode) => void;
}

/** The relation as a row of pills; Form.Item hands it value and onChange. */
function RelationPills({ value, onChange }: PillsProps) {
  return (
    <div className="bd-guardian-relations" role="radiogroup" aria-label={t("Patient:Guardian:Relation")}>
      {RELATION_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={["bd-guardian-relation", value === option.value && "bd-guardian-relation--active"]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange?.(option.value)}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}

interface Props {
  index: number;
}

/**
 * "Quan hệ với khách hàng*" and, behind "Khác", what the BA asks for instead of
 * a fixed relation: the relation in words, the paper that proves it, and
 * optionally a scan of that paper.
 */
export function GuardianRelationField({ index }: Props) {
  const form = Form.useFormInstance();
  const relation: GuardianRelationCode | undefined = Form.useWatch(["guardians", index, "relation"], form);
  const required = (message: string) => [{ required: true, message: t(message) }];

  return (
    <>
      <Form.Item
        name={["guardians", index, "relation"]}
        label={<span className="bd-guardian-label">{t("Patient:Guardian:Relation")}<span className="floating-field-required">*</span></span>}
        rules={required("Patient:Guardian:RelationRequired")}
      >
        <RelationPills />
      </Form.Item>

      {relation === GUARDIAN_RELATION.Other && (
        <div className="bd-guardian-other">
          <FloatingField
            label={t("Patient:Guardian:RelationNote")}
            name={["guardians", index, "relationNote"]}
            required
            rules={[{ required: true, whitespace: true, message: t("Patient:Guardian:RelationNoteRequired") }]}
          >
            <Input maxLength={200} />
          </FloatingField>

          <FloatingField
            label={t("Patient:Guardian:ProofType")}
            name={["guardians", index, "proofType"]}
            required
            rules={required("Patient:Guardian:ProofTypeRequired")}
          >
            <Select options={PROOF_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))} />
          </FloatingField>

          <GuardianProofUpload index={index} />
        </div>
      )}
    </>
  );
}
