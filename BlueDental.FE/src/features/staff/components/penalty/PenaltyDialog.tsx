import { DatePicker, Form, Input, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import {
  PENALTY_ACTION,
  type BranchStaffOption,
  type PenaltyAction,
  type StaffPenaltyDto,
  type StaffPenaltyInput,
  type StaffViolationTypeDto,
} from "../../api/staffPenaltyApi";
import { actionOptions } from "./penaltyConfig";

interface FormValues {
  staffId?: string;
  violationDate?: Dayjs;
  violationTypeId?: string;
  action?: PenaltyAction;
  fineAmount?: number;
  description?: string;
}

interface Props {
  open: boolean;
  /** The draft being edited; null opens an empty form. */
  penalty: StaffPenaltyDto | null;
  staffOptions: BranchStaffOption[];
  violationTypes: StaffViolationTypeDto[];
  saving: boolean;
  onSubmit: (input: StaffPenaltyInput) => void;
  onClose: () => void;
}

function initialValues(penalty: StaffPenaltyDto | null): FormValues {
  if (!penalty) return { violationDate: dayjs() };
  return {
    staffId: penalty.staffId,
    violationDate: dayjs(penalty.violationDate),
    violationTypeId: penalty.violationTypeId ?? undefined,
    action: penalty.action,
    fineAmount: penalty.action === PENALTY_ACTION.Fine ? penalty.fineAmount : undefined,
    description: penalty.description ?? undefined,
  };
}

/** Lập / Sửa phiếu chế tài. Picking a violation type pre-fills its default fine. */
export function PenaltyDialog({ open, penalty, staffOptions, violationTypes, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const action = Form.useWatch("action", form);

  const handleTypeChange = (typeId?: string) => {
    const fine = violationTypes.find((type) => type.id === typeId)?.defaultFineAmount ?? 0;
    if (fine > 0) form.setFieldsValue({ action: PENALTY_ACTION.Fine, fineAmount: fine });
  };

  const handleFinish = (values: FormValues) => {
    onSubmit({
      staffId: values.staffId!,
      violationDate: values.violationDate!.format("YYYY-MM-DD"),
      violationTypeId: values.violationTypeId ?? null,
      action: values.action!,
      fineAmount: values.action === PENALTY_ACTION.Fine ? values.fineAmount ?? 0 : 0,
      description: values.description?.trim() || null,
    });
  };

  return (
    <AppDialog
      open={open}
      title={t(penalty ? "StaffPenalty:DialogEdit" : "StaffPenalty:DialogCreate")}
      width={640}
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {/* The dialog is destroyed on close, so each opening mounts the form afresh with these values. */}
      <Form
        form={form}
        layout="vertical"
        className="staff-penalty-form"
        initialValues={initialValues(penalty)}
        onFinish={handleFinish}
        preserve={false}
      >
        <Form.Item name="staffId" label={t("StaffPenalty:Field:Staff")} rules={[{ required: true, message: t("StaffPenalty:Required:Staff") }]}>
          <Select showSearch optionFilterProp="label" options={staffOptions} />
        </Form.Item>
        <Form.Item name="violationDate" label={t("StaffPenalty:Field:Date")} rules={[{ required: true, message: t("StaffPenalty:Required:Date") }]}>
          <DatePicker format="DD/MM/YYYY" disabledDate={(day) => day.isAfter(dayjs(), "day")} />
        </Form.Item>
        <Form.Item name="violationTypeId" label={t("StaffPenalty:Field:Type")}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={violationTypes.map((type) => ({ value: type.id, label: type.name }))}
            onChange={handleTypeChange}
          />
        </Form.Item>
        <Form.Item name="action" label={t("StaffPenalty:Field:Action")} rules={[{ required: true, message: t("StaffPenalty:Required:Action") }]}>
          <Select options={actionOptions()} />
        </Form.Item>
        {/* Hidden, not unmounted: picking a type fills the amount in the same
            change that switches the action to Phạt tiền. */}
        <Form.Item
          name="fineAmount"
          label={t("StaffPenalty:Field:Amount")}
          className="staff-penalty-form__wide"
          hidden={action !== PENALTY_ACTION.Fine}
          rules={
            action === PENALTY_ACTION.Fine
              ? [{ required: true, type: "number", min: 1, message: t("StaffPenalty:Required:Amount") }]
              : []
          }
        >
          <CurrencyInput />
        </Form.Item>
        <Form.Item name="description" label={t("StaffPenalty:Field:Description")} className="staff-penalty-form__wide">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
