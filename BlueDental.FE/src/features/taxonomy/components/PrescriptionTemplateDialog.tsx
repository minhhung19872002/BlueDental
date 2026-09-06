import { Col, Form, Input, InputNumber, Row } from "antd";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import {
  TAXONOMY_GROUP,
  useCatalogEntries,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import {
  EMPTY_PRESCRIPTION_LINE,
  PrescriptionLineEditor,
  type PrescriptionLine,
} from "@/components/prescription-lines";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  advice: string;
  priority: number;
}

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

export function PrescriptionTemplateDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const branchFilter = useBranchFilter();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  // The medicine picker offers this branch's thuốc catalog.
  const medicinesQuery = useCatalogEntries(branchFilter, TAXONOMY_GROUP.MedicationType, {
    scope: "catalog",
    skipCount: 0,
    maxResultCount: 200,
  });
  const medicines = medicinesQuery.data?.items ?? [];

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const [lines, setLines] = useState<PrescriptionLine[]>([{ ...EMPTY_PRESCRIPTION_LINE }]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: entry?.name ?? "",
      advice: entry?.description ?? "",
      priority: entry?.sortOrder ?? 0,
    });
    setLines(
      entry && entry.prescriptionLines.length > 0
        ? entry.prescriptionLines.map((line) => ({
            id: line.id,
            medicineEntryId: line.medicineEntryId,
            timesPerDay: line.timesPerDay,
            amountPerTime: line.amountPerTime,
            days: line.days,
            usage: line.usage,
            otherUsage: line.otherUsage ?? null,
          }))
        : [{ ...EMPTY_PRESCRIPTION_LINE }],
    );
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  // Read through a ref for the same reason the other dialogs do: a refetch
  // must not change what a save is about to write.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    const advice = values.advice?.trim() || undefined;

    // A line with no medicine picked is the empty row the table always shows.
    const filled = lines.filter((line) => line.medicineEntryId);
    const taxonomy =
      entry?.taxonomyId ??
      defaults.current.defaultTaxonomyId ??
      defaults.current.groups[0]?.id ??
      "";
    const sortOrder = Number(values.priority) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: taxonomy,
            name: trimmed,
            description: advice,
            price: entry.price,
            isActive: entry.isActive,
            prescriptionLines: filled,
            sortOrder,
          },
        });
        toast.success(t("Đã cập nhật đơn thuốc mẫu"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: taxonomy,
          name: trimmed,
          description: advice,
          prescriptionLines: filled,
          sortOrder,
        });
        toast.success(t("Đã thêm đơn thuốc mẫu"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật đơn thuốc mẫu") : t("Thêm đơn thuốc mẫu")}
      width={1040}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", advice: "", priority: 0 }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="name"
              label={t("Tên đơn thuốc mẫu")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên đơn thuốc mẫu") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="advice" label={t("Lời dặn")}>
              <Input />
            </FloatingField>
          </Col>
        </Row>

        <PrescriptionLineEditor lines={lines} medicines={medicines} onChange={setLines} />

        <Row gutter={[16, { xs: 20, sm: 12 }]} className="bd-mt3">
          <Col xs={24} sm={12}>
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
