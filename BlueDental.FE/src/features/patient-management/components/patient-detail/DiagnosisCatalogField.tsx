import { useMemo, useState } from "react";
import { Button, Form, Select, Tooltip } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import {
  TAXONOMY_GROUP,
  useTaxonomyGroups,
  type CatalogEntryDto,
} from "@/features/taxonomy/api/taxonomyApi";
import { RichCatalogDialog } from "@/features/taxonomy/components/RichCatalogDialog";
import { useAbility } from "@/hooks/useAbility";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { DiagnosisOption } from "./DiagnosisDoctorFields";

interface Props {
  options: DiagnosisOption[];
}

/**
 * The "Chẩn đoán" picker of "Tạo chẩn đoán", with a round + beside it that adds
 * a missing diagnosis to the catalog on the spot (QA #28) instead of a trip to
 * Danh mục. Once saved, the new entry is selected — BA asked for that.
 *
 * The + is offered to whoever may add to the Chẩn đoán catalog; the server
 * checks the same right on the call.
 */
export function DiagnosisCatalogField({ options }: Props) {
  const form = Form.useFormInstance();
  const { canCreate } = useAbility("catalogDiagnosis");
  // The catalog refetches after the save, but the entry is listed straight
  // away so the field never shows its bare id while that lands.
  const [created, setCreated] = useState<DiagnosisOption[]>([]);

  const shown = useMemo(() => {
    const extra = created.filter((item) => !options.some((o) => o.value === item.value));
    return extra.length ? [...options, ...extra] : options;
  }, [options, created]);

  const handleCreated = (entry: CatalogEntryDto) => {
    setCreated((list) => [...list, { value: entry.id, label: entry.name }]);
    form.setFieldValue("diagnosisId", entry.id);
  };

  return (
    <div className="pd-diagnosis-pick">
      <FloatingField name="diagnosisId" label={t("Patient:Tab:Diagnosis")} required>
        <Select
          showSearch
          optionFilterProp="label"
          prefix={<SearchOutlined />}
          options={shown}
          notFoundContent={t("Common:NoResults")}
        />
      </FloatingField>
      {canCreate && <QuickDiagnosisButton onCreated={handleCreated} />}
    </div>
  );
}

/** The + and Danh mục's own "Tạo mới chẩn đoán" dialog, the same form as there. */
function QuickDiagnosisButton({ onCreated }: { onCreated: (entry: CatalogEntryDto) => void }) {
  const branchId = useCurrentBranchId();
  const groups = useTaxonomyGroups(branchId, TAXONOMY_GROUP.Diagnosis).data?.items;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t("Patient:Diagnosis:QuickCreate")}>
        <Button
          shape="circle"
          className="pd-diagnosis-round"
          // The slip's own "Thêm chẩn đoán" command sits in the same form.
          aria-label={t("Patient:Diagnosis:QuickCreateLabel")}
          icon={<PlusOutlined />}
          // The dialog starts on the first group, so it waits for the list.
          disabled={!groups}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <RichCatalogDialog
        open={open}
        entry={null}
        groups={groups ?? []}
        noun={t("Taxonomy:Noun:Diagnosis")}
        onCreated={onCreated}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
