import { Button, Checkbox, Col, Form, Input, InputNumber, Popover, Row, Select, Table, Tooltip } from "antd";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  PRESCRIPTION_USAGE,
  TAXONOMY_GROUP,
  useCatalogEntries,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type PrescriptionTemplateLineDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
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

type Line = Omit<PrescriptionTemplateLineDto, "quantity" | "medicineName">;

const EMPTY_LINE: Line = {
  medicineEntryId: "",
  timesPerDay: 1,
  amountPerTime: 1,
  days: 1,
  usage: 0,
  otherUsage: null,
};

/** The six choices the reference lists, in its order. */
function usageOptions(): { flag: number; label: string }[] {
  return [
    { flag: PRESCRIPTION_USAGE.AfterMeal, label: t("Sau khi ăn") },
    { flag: PRESCRIPTION_USAGE.BeforeMeal, label: t("Trước khi ăn") },
    { flag: PRESCRIPTION_USAGE.DuringMeal, label: t("Trong khi ăn") },
    { flag: PRESCRIPTION_USAGE.AfterWakingUp, label: t("Sau khi thức dậy") },
    { flag: PRESCRIPTION_USAGE.BeforeSleep, label: t("Trước khi ngủ") },
    { flag: PRESCRIPTION_USAGE.Other, label: t("Khác") },
  ];
}

/** What one line stores for "Sử dụng": the chosen flags, plus the written-out
 * text when "Khác" is among them. */
interface UsageValue {
  usage: number;
  otherUsage: string | null;
}

function usageLabel({ usage, otherUsage }: UsageValue): string {
  const picked = usageOptions()
    .filter((option) => (usage & option.flag) !== 0)
    .map((option) =>
      // "Khác" reads as whatever was written for it.
      option.flag === PRESCRIPTION_USAGE.Other && otherUsage ? otherUsage : option.label,
    );

  return picked.length === 0 ? t("Sử dụng") : picked.join(", ");
}

/**
 * "Sử dụng" — a multi-select, the way the reference builds it.
 *
 * Nothing leaves this popover until "Lưu" is pressed: the boxes edit a draft,
 * so a half-made choice never reaches the line behind it. Ticking "Khác" asks
 * for the usage in words and will not save without it, as the reference does.
 */
function UsagePicker({
  value,
  onChange,
}: {
  value: UsageValue;
  onChange: (next: UsageValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UsageValue>(value);
  const [error, setError] = useState<string | null>(null);

  // Re-opening starts from what is actually stored, not from an abandoned draft.
  const show = (next: boolean) => {
    if (next) {
      setDraft(value);
      setError(null);
    }
    setOpen(next);
  };

  const wantsOther = (draft.usage & PRESCRIPTION_USAGE.Other) !== 0;

  const commit = () => {
    if (wantsOther && !draft.otherUsage?.trim()) {
      setError(t("Vui lòng nhập giá trị!"));
      return;
    }

    onChange({
      usage: draft.usage,
      otherUsage: wantsOther ? (draft.otherUsage?.trim() ?? null) : null,
    });
    setOpen(false);
  };

  const content = (
    <div className="bd-usage-picker">
      {usageOptions().map((option) => {
        const checked = (draft.usage & option.flag) !== 0;
        return (
          <Checkbox
            key={option.flag}
            checked={checked}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                usage: event.target.checked
                  ? current.usage | option.flag
                  : current.usage & ~option.flag,
              }))
            }
          >
            {option.label}
          </Checkbox>
        );
      })}

      {wantsOther && (
        <div className="bd-usage-other">
          <Input
            autoFocus
            status={error ? "error" : undefined}
            placeholder={t("Vui lòng nhập")}
            aria-label={t("Cách sử dụng khác")}
            value={draft.otherUsage ?? ""}
            onChange={(event) => {
              setDraft((current) => ({ ...current, otherUsage: event.target.value }));
              if (error) setError(null);
            }}
            onPressEnter={commit}
          />
          {error && (
            <p role="alert" className="bd-usage-error">
              <ExclamationCircleOutlined aria-hidden="true" /> {error}
            </p>
          )}
        </div>
      )}

      <div className="bd-usage-footer">
        <Button type="primary" size="small" icon={<SaveOutlined />} onClick={commit}>
          {t("Lưu")}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      open={open}
      onOpenChange={show}
    >
      <Button className="bd-usage-trigger">{usageLabel(value)}</Button>
    </Popover>
  );
}

/**
 * Đơn thuốc mẫu — a name, a piece of advice, and a table of medicine lines.
 *
 * "Số lượng" is shown disabled and derived from the three numbers beside it,
 * exactly as the reference does, so the stored template can never carry a
 * quantity that disagrees with its own dose.
 */
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
  const [lines, setLines] = useState<Line[]>([EMPTY_LINE]);

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
        : [EMPTY_LINE],
    );
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const patch = (index: number, change: Partial<Line>) =>
    setLines((current) =>
      current.map((line, at) => (at === index ? { ...line, ...change } : line)),
    );

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

  const columns = useMemo<ColumnsType<Line>>(
    () => [
      {
        key: "medicine",
        title: t("Tên thuốc"),
        width: 260,
        render: (_, line, index) => (
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
            aria-label={t("Tên thuốc")}
            placeholder={t("Chọn thuốc")}
            value={line.medicineEntryId || undefined}
            onChange={(next) => patch(index, { medicineEntryId: next })}
            options={medicines.map((medicine) => ({
              value: medicine.id,
              label: medicine.name,
            }))}
          />
        ),
      },
      {
        key: "timesPerDay",
        title: t("Ngày uống"),
        width: 120,
        render: (_, line, index) => (
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            aria-label={t("Ngày uống")}
            value={line.timesPerDay}
            onChange={(next) => patch(index, { timesPerDay: Number(next) || 0 })}
          />
        ),
      },
      {
        key: "amountPerTime",
        title: t("Mỗi lần"),
        width: 110,
        render: (_, line, index) => (
          <InputNumber
            min={0}
            step={0.5}
            style={{ width: "100%" }}
            aria-label={t("Mỗi lần")}
            value={line.amountPerTime}
            onChange={(next) => patch(index, { amountPerTime: Number(next) || 0 })}
          />
        ),
      },
      {
        key: "days",
        title: t("Số ngày"),
        width: 110,
        render: (_, line, index) => (
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            aria-label={t("Số ngày")}
            value={line.days}
            onChange={(next) => patch(index, { days: Number(next) || 0 })}
          />
        ),
      },
      {
        key: "quantity",
        title: t("Số lượng"),
        width: 110,
        render: (_, line) => (
          <InputNumber
            disabled
            style={{ width: "100%" }}
            aria-label={t("Số lượng")}
            value={line.timesPerDay * line.amountPerTime * line.days}
          />
        ),
      },
      {
        key: "usage",
        title: t("Sử dụng"),
        width: 200,
        render: (_, line, index) => (
          <UsagePicker
            value={{ usage: line.usage, otherUsage: line.otherUsage ?? null }}
            onChange={(next) => patch(index, next)}
          />
        ),
      },
      {
        key: "remove",
        title: "",
        width: 60,
        align: "center",
        render: (_, __, index) => (
          <Tooltip title={t("Xoá dòng")}>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              aria-label={t("Xoá dòng thuốc {0}", String(index + 1))}
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((_, at) => at !== index))}
            />
          </Tooltip>
        ),
      },
    ],
    [lines.length, medicines],
  );

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

        <div className="bd-row-end bd-mb2">
          <Button
            icon={<PlusOutlined />}
            onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
          >
            {t("Thêm mới")}
          </Button>
        </div>

        <Table<Line>
          columns={columns}
          dataSource={lines}
          rowKey={(line, index) => line.id ?? String(index)}
          pagination={false}
          size="small"
          className="bd-line-table"
        />

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
