import { useMemo, type ReactNode } from "react";
import { Button, Checkbox, Form, Input } from "antd";
import type { Rule } from "antd/es/form";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { PERSON_NAME_PATTERN } from "@/utils/vietnameseName";

/** "DH26" — the clinic's own series; the server keeps its numbers four digits wide. */
const SERIES_PREFIX = /^DH\d{2}$/i;
const SHORT_NUMBER = /^\d{1,3}$/;
const SEQUENCE_DIGITS = 4;

interface Props {
  /** The fixed half of the code, greyed inside the field. */
  codePrefix: string;
  /** The duplicate check run when "Mã khách hàng" loses focus. */
  codeRule: Rule;
  createdAt: string | null;
  sourceTaxonomyId?: string;
  onAddSource: () => void;
  onSourceGroupChange: () => void;
  /** "Điện thoại" with the shared-phone list and link hung off it (P2710_02). */
  phoneField: ReactNode;
}

/**
 * Column one of the hồ sơ dialog: who the patient is and where they came from.
 *
 * "Kênh kết nối" stays disabled until a source group is chosen, exactly as the
 * reference disables it — a channel without its group means nothing.
 */
export function PatientSourceColumn({
  codePrefix,
  codeRule,
  createdAt,
  sourceTaxonomyId,
  onAddSource,
  onSourceGroupChange,
  phoneField,
}: Props) {
  const form = Form.useFormInstance();
  const sourceGroups = useTaxonomyGroupOptions(CATALOG_GROUP.Source);
  const sourceEntries = useCatalogOptions(CATALOG_GROUP.Source);

  const channels = useMemo(
    () =>
      (sourceEntries.data ?? [])
        .filter((entry) => entry.taxonomyId === sourceTaxonomyId)
        .map((entry) => ({ value: entry.id, label: entry.name })),
    [sourceEntries.data, sourceTaxonomyId],
  );

  // "200" reads back as "0200", the way it is stored and the series counts it.
  // Runs before the blur check, so the check sees the padded number.
  const handleCodeBlur = () => {
    const typed = String(form.getFieldValue("codeSequence") ?? "").trim();
    if (SERIES_PREFIX.test(codePrefix) && SHORT_NUMBER.test(typed)) {
      form.setFieldValue("codeSequence", typed.padStart(SEQUENCE_DIGITS, "0"));
    }
  };

  return (
    <>
      {/* A new hồ sơ opens on the next free number, which the desk may
          overwrite; the label stays on the border so it never sits over the
          greyed prefix. */}
      <FloatingField
        label={t("Patient:Col:PatientCodeLong")}
        name="codeSequence"
        alwaysFloat
        validateTrigger={["onChange", "onBlur"]}
        rules={[{ pattern: /^\d*$/, message: t("Patient:Form:CodeDigitsOnly") }, codeRule]}
      >
        <Input
          prefix={<span className="bd-patient-codeprefix">{codePrefix}</span>}
          inputMode="numeric"
          aria-label={t("Patient:Form:CodeNumberPart")}
          onBlur={handleCodeBlur}
        />
      </FloatingField>

      <FloatingField
        label={t("Patient:Col:FullName")}
        name="fullName"
        required
        rules={[
          { required: true, message: t("Patient:Form:RequiredFullName") },
          { max: 50, message: t("Patient:Misc:Max50Chars") },
          { pattern: PERSON_NAME_PATTERN, message: t("Patient:Form:InvalidFullName") },
        ]}
      >
        <Input maxLength={50} />
      </FloatingField>

      <Form.Item name="uppercase" valuePropName="checked" className="bd-patient-upper">
        <Checkbox>{t("Patient:Editor:Uppercase")}</Checkbox>
      </Form.Item>

      {phoneField}

      <div className="bd-patient-sourcerow">
        <FloatingField label={t("Patient:Source:SelectType")} name="sourceTaxonomyId">
          <SearchSelect
            options={(sourceGroups.data ?? []).map((group) => ({
              value: group.id,
              label: group.name,
            }))}
            placeholder={t("Patient:Source:SelectType")}
            emptyText={t("Patient:Form:SourceNotFound")}
            allowClear
            onChange={onSourceGroupChange}
          />
        </FloatingField>

        {/* The reference puts a quick-add beside the picker so the front desk
            can file a new source without leaving the record half-typed. */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          aria-label={t("Patient:Source:AddType")}
          onClick={onAddSource}
        />
      </div>

      <FloatingField label={t("Patient:Col:Channel")} name="sourceEntryId">
        <SearchSelect
          options={channels}
          placeholder={t("Patient:Col:Channel")}
          emptyText={t("Patient:Source:NoChannel")}
          disabled={!sourceTaxonomyId}
          allowClear
        />
      </FloatingField>

      <FloatingField label={t("Patient:Col:CreatedAt")} name="createdAtLabel">
        <Input readOnly value={dayjs(createdAt ?? undefined).format("DD/MM/YYYY")} />
      </FloatingField>

      <FloatingField label={t("Patient:Source:VisitReason")} name="examinationReason">
        <Input.TextArea rows={3} maxLength={1000} />
      </FloatingField>
    </>
  );
}
