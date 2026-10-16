import { Checkbox, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import {
  RESTORATION_KIND,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

interface FormValues {
  taxonomyId: string;
  name: string;
  brand: string;
  origin: string;
  warranty: string;
  isDeleted: boolean;
  priority: number;
}

const EMPTY: FormValues = {
  taxonomyId: "",
  name: "",
  brand: "",
  origin: "",
  warranty: "",
  isDeleted: false,
  priority: 0,
};

/** Blank text fields are stored as null, not as an empty string. */
const orNull = (value: string | undefined) => value?.trim() || null;

/** The kind a group stands for; the server decides it the same way. */
const kindOf = (group: TaxonomyDto | undefined) =>
  group?.subGroup === "implant" ? RESTORATION_KIND.Implant : RESTORATION_KIND.Crown;

/**
 * Vật liệu nha khoa — BlueDental's own catalog (clinic, 2026-10-16): the crown
 * and implant types mẫu 5 lists under "Loại", with the brand, origin and
 * warranty it fills in when one is ticked. Filed under the fixed groups "Răng
 * sứ" / "Răng Implant", which is what makes a material a crown or an implant.
 * Soft-deleted like Dịch vụ — a type already printed on a sheet keeps its name
 * there.
 */
export function RestorationDialog({ open, entry, groups, defaultTaxonomyId, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const isDeleted = Form.useWatch("isDeleted", form) ?? false;

  // Read through a ref: a refetch landing while the dialog is open must not
  // reset the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    form.setFieldsValue({
      taxonomyId: entry?.taxonomyId ?? fallback,
      name: entry?.name ?? "",
      brand: entry?.restoration?.brand ?? "",
      origin: entry?.restoration?.origin ?? "",
      warranty: entry?.restoration?.warranty ?? "",
      isDeleted: entry?.isDeleted ?? false,
      priority: entry?.sortOrder ?? 0,
    });
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async (values: FormValues) => {
    const restoration = {
      kind: kindOf(groups.find((group) => group.id === values.taxonomyId)),
      brand: orNull(values.brand),
      origin: orNull(values.origin),
      warranty: orNull(values.warranty),
    };
    const sortOrder = Number(values.priority) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: values.taxonomyId,
            name: values.name.trim(),
            code: entry.code ?? undefined,
            isActive: entry.isActive,
            isDeleted: values.isDeleted,
            sortOrder,
            restoration,
          },
        });
        toast.success(values.isDeleted ? t("Taxonomy:Catalog:SoftDeleted") : t("Taxonomy:Restoration:Updated"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: values.taxonomyId,
          name: values.name.trim(),
          sortOrder,
          restoration,
        });
        toast.success(t("Taxonomy:Restoration:Created"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Taxonomy:Restoration:UpdateTitle") : t("Taxonomy:Restoration:CreateTitle")}
      width={720}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="name"
              label={t("Taxonomy:Restoration:NameLabel")}
              required
              rules={[{ required: true, message: t("Taxonomy:Restoration:NameRequired") }]}
            >
              <Input autoFocus maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField
              name="taxonomyId"
              label={t("Taxonomy:Restoration:GroupLabel")}
              required
              rules={[{ required: true, message: t("Taxonomy:Restoration:GroupRequired") }]}
            >
              <Select options={groups.map((group) => ({ value: group.id, label: group.name }))} />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="brand" label={t("Taxonomy:Restoration:Brand")}>
              <Input maxLength={128} />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="origin" label={t("Taxonomy:Restoration:Origin")}>
              <Input maxLength={128} />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="warranty" label={t("Taxonomy:Restoration:Warranty")}>
              <Input maxLength={64} />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="priority" label={t("Taxonomy:Common:Priority")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col span={24}>
            {/* One state, two boxes, as on the other soft-deleted catalogs. */}
            <div className="bd-dialog-row">
              <Checkbox
                checked={!isDeleted}
                disabled={!entry}
                onChange={() => form.setFieldValue("isDeleted", false)}
              >
                {t("Taxonomy:Common:Active")}
              </Checkbox>
              <Checkbox
                checked={isDeleted}
                disabled={!entry}
                title={entry ? undefined : t("Taxonomy:Catalog:EditOnlyHint")}
                onChange={() => form.setFieldValue("isDeleted", true)}
              >
                {t("Taxonomy:Catalog:SoftDeleted")}
              </Checkbox>
            </div>
            <Form.Item name="isDeleted" hidden>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
