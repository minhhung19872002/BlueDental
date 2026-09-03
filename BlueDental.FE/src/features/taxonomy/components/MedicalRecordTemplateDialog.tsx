import { Button, Col, Form, Input, InputNumber, Row, Space } from "antd";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { MedicalRecordSheet, type MedicalRecordFields } from "./MedicalRecordSheet";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  priority: number;
}

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;

/** A template that predates the JSON shape, or a corrupt one, opens empty. */
function parseFields(content: string | null): MedicalRecordFields {
  if (!content) return {};

  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as MedicalRecordFields) : {};
  } catch {
    return {};
  }
}

/**
 * Bệnh án mẫu — a title and the A4 sheet itself, with the reference's zoom
 * control above it.
 *
 * The filled-in cells are stored as JSON on the entry's content, so the sheet
 * can be re-laid-out (and later printed through QuestPDF) without a migration.
 */
export function MedicalRecordTemplateDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const [fields, setFields] = useState<MedicalRecordFields>({});
  const [zoom, setZoom] = useState(0.9);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: entry?.name ?? "", priority: entry?.sortOrder ?? 0 });
    setFields(parseFields(entry?.content ?? null));
    setZoom(0.9);
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  // Read through a ref for the same reason the other dialogs do: a refetch
  // must not change what a save is about to write.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    const taxonomy =
      entry?.taxonomyId ??
      defaults.current.defaultTaxonomyId ??
      defaults.current.groups[0]?.id ??
      "";
    const sortOrder = Number(values.priority) || 0;
    const content = JSON.stringify(fields);

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: taxonomy,
            name: trimmed,
            content,
            price: entry.price,
            isActive: entry.isActive,
            sortOrder,
          },
        });
        toast.success(t("Đã cập nhật mẫu bệnh án"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: taxonomy,
          name: trimmed,
          content,
          sortOrder,
        });
        toast.success(t("Đã thêm mẫu bệnh án"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật mẫu bệnh án") : t("Thêm mẫu bệnh án")}
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
        initialValues={{ name: "", priority: 0 }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={16}>
            <FloatingField
              name="name"
              label={t("Tiêu đề bệnh án")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên mẫu bệnh án") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col xs={24} sm={8}>
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>

        <div className="bd-cat-headrow bd-mb2">
          <p className="bd-zoom">
            {/* The reference marks "nền vàng" with a sample of the shading it
                is talking about. */}
            <span aria-hidden="true">💡</span>
            {t("Nhấp vào các ô")}
            <span className="bd-a4-swatch">{t("nền vàng")}</span>
            {t("để chỉnh sửa trực tiếp trên bệnh án")}
          </p>
          <Space.Compact>
            <Button
              icon={<MinusOutlined />}
              aria-label={t("Thu nhỏ")}
              onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
            />
            <Button className="bd-zoom-value" onClick={() => setZoom(0.9)}>
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              icon={<PlusOutlined />}
              aria-label={t("Phóng to")}
              onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
            />
          </Space.Compact>
        </div>

        <MedicalRecordSheet value={fields} onChange={setFields} zoom={zoom} />
      </Form>
    </AppDialog>
  );
}
