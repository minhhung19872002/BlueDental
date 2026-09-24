import { useMemo } from "react";
import { Button, Checkbox, Form, Input } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { CATALOG_GROUP, useCatalogOptions, useTaxonomyGroupOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";

interface Props {
  /** The fixed half of the code, greyed inside the field. */
  codePrefix: string;
  createdAt: string | null;
  sourceTaxonomyId?: string;
  onAddSource: () => void;
  onSourceGroupChange: () => void;
}

/**
 * Column one of the hồ sơ dialog: who the patient is and where they came from.
 *
 * "Kênh kết nối" stays disabled until a source group is chosen, exactly as the
 * reference disables it — a channel without its group means nothing.
 */
export function PatientSourceColumn({
  codePrefix,
  createdAt,
  sourceTaxonomyId,
  onAddSource,
  onSourceGroupChange,
}: Props) {
  const sourceGroups = useTaxonomyGroupOptions(CATALOG_GROUP.Source);
  const sourceEntries = useCatalogOptions(CATALOG_GROUP.Source);

  const channels = useMemo(
    () =>
      (sourceEntries.data ?? [])
        .filter((entry) => entry.taxonomyId === sourceTaxonomyId)
        .map((entry) => ({ value: entry.id, label: entry.name })),
    [sourceEntries.data, sourceTaxonomyId],
  );

  return (
    <>
      <FloatingField
        label={t("Patient:Col:PatientCodeLong")}
        name="codeSequence"
        rules={[{ pattern: /^\d*$/, message: t("Patient:Form:CodeDigitsOnly") }]}
      >
        <Input
          prefix={<span className="bd-patient-codeprefix">{codePrefix}</span>}
          inputMode="numeric"
          aria-label={t("Patient:Form:CodeNumberPart")}
        />
      </FloatingField>

      <FloatingField
        label={t("Patient:Col:FullName")}
        name="fullName"
        required
        rules={[
          { required: true, message: t("Patient:Form:RequiredFullName") },
          { max: 50, message: t("Patient:Misc:Max50Chars") },
        ]}
      >
        <Input maxLength={50} />
      </FloatingField>

      <Form.Item name="uppercase" valuePropName="checked" className="bd-patient-upper">
        <Checkbox>{t("Patient:Editor:Uppercase")}</Checkbox>
      </Form.Item>

      <FloatingField
        label={t("Patient:Form:Telephone")}
        name="phone"
        required
        rules={[
          { required: true, message: t("Patient:Form:RequiredPhone") },
          { pattern: /^\d{8,15}$/, message: t("Patient:Form:InvalidPhone") },
        ]}
      >
        <Input type="tel" autoComplete="off" maxLength={15} />
      </FloatingField>

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
