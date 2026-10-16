import { useEffect, useRef } from "react";
import { Col, Form, Input, Row } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import {
  useRestorationMaterials,
  useSaveRestorationMaterial,
  type RestorationMaterialKind,
} from "@/hooks/useRestorationMaterials";
import { t } from "@/lib/i18n";
import type { SheetMaterials } from "./useSheetMaterials";

interface Props {
  materials: SheetMaterials;
}

interface FormValues {
  name: string;
  brand: string;
  origin: string;
  warranty: string;
}

const orNull = (value: string | undefined) => value?.trim() || null;

/**
 * ⊕ / double click on "Loại" (mẫu 5): adds a crown or implant type to Danh mục
 * → Vật liệu nha khoa, or corrects one, without leaving the sheet. The kind is
 * the part of the sheet it was opened from. Saving writes the catalog, not the
 * sheet — the sheet takes the type as ticked and is saved by its own "Lưu".
 */
export function MaterialTypeDialog({ materials }: Props) {
  const { request } = materials;
  const catalog = useRestorationMaterials().data ?? [];
  const save = useSaveRestorationMaterial();
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  const existing = request?.materialId ? (catalog.find((item) => item.id === request.materialId) ?? null) : null;
  const isCrown = request?.kind !== 2;

  // Seeded once per opening, read through a ref: a catalog refetch landing
  // while the dialog is open must not reset the typing.
  const seed = useRef(existing);
  seed.current = existing;
  useEffect(() => {
    if (!request) return;
    form.setFieldsValue({
      name: seed.current?.name ?? "",
      brand: seed.current?.brand ?? "",
      origin: seed.current?.origin ?? "",
      warranty: seed.current?.warranty ?? "",
    });
  }, [request, form]);

  const submit = async (values: FormValues) => {
    if (!request) return;
    try {
      const saved = await save.mutateAsync({
        existing,
        input: {
          kind: request.kind as RestorationMaterialKind,
          name: values.name.trim(),
          brand: orNull(values.brand),
          origin: orNull(values.origin),
          warranty: orNull(values.warranty),
        },
      });
      toast.success(existing ? t("Taxonomy:Restoration:Updated") : t("Taxonomy:Restoration:Created"));
      materials.apply({ id: saved.id, name: saved.name, brand: saved.brand, origin: saved.origin, warranty: saved.warranty });
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const title = existing
    ? t(isCrown ? "Patient:MedRecord:Material:EditCrown" : "Patient:MedRecord:Material:EditImplant")
    : t(isCrown ? "Patient:MedRecord:Material:AddCrown" : "Patient:MedRecord:Material:AddImplant");

  return (
    <AppDialog
      open={Boolean(request)}
      title={title}
      width={560}
      canSave={name.trim().length > 0}
      saving={save.isPending}
      onSave={() => form.submit()}
      onClose={materials.close}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void submit(values)}>
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="name"
              label={t("Patient:MedRecord:Material:Type")}
              required
              rules={[{ required: true, message: t("Taxonomy:Restoration:NameRequired") }]}
            >
              <Input autoFocus maxLength={200} />
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
        </Row>
      </Form>
    </AppDialog>
  );
}
