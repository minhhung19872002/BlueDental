import { useEffect, useRef } from "react";
import { Checkbox, Col, Form, Input, InputNumber, Row } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { AppDialog } from "@/components/AppDialog";
import { useCreateServiceCounter, useUpdateServiceCounter } from "../api/queueMutations";
import {
  MAX_COUNTER_NAME,
  PREFIX_PATTERN,
  previewNumber,
  toCounterFormValues,
  toCounterInput,
  type CounterFormValues,
} from "../utils/counterForm";
import type { ServiceCounter } from "../types";
import { CounterResetBox } from "./CounterResetBox";
import { DentistPickerField } from "./DentistPickerField";

interface CounterFormDialogProps {
  open: boolean;
  /** The counter being edited; null adds a new one. */
  counter: ServiceCounter | null;
  counters: ServiceCounter[];
  onClose: () => void;
}

const POSITIVE = { type: "number", min: 1 } as const;

/**
 * Thêm / Chỉnh sửa quầy, laid out as the BA mock: name, fixed dentist, number
 * prefix and start, wait threshold, daily reset, and "Đặt lại số thứ tự ngay".
 * The pace per patient is not on the mock (owner, 2026-10-09): a counter keeps
 * the one it has, a new counter takes the server's default.
 */
export function CounterFormDialog({ open, counter, counters, onClose }: CounterFormDialogProps) {
  const [form] = Form.useForm<CounterFormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const prefix = Form.useWatch("numberPrefix", form) ?? "";
  const start = Form.useWatch("startNumber", form);
  const dentistId = Form.useWatch("dentistId", form);
  const create = useCreateServiceCounter();
  const update = useUpdateServiceCounter();

  // The list refetches while the dialog is open; reading the counter through a
  // ref keeps a refetch from resetting what is being typed.
  const initial = useRef(counter);
  initial.current = counter;
  const counterId = counter?.id;

  useEffect(() => {
    if (open) form.setFieldsValue(toCounterFormValues(initial.current));
  }, [open, counterId, form]);

  const submit = async (values: Partial<CounterFormValues>) => {
    // Fields not on screen (the pace per patient) keep what the counter has.
    const full = { ...toCounterFormValues(counter), ...values };
    try {
      if (counter) {
        await update.mutateAsync({ id: counter.id, data: toCounterInput(full, counter.sortOrder) });
        toast.success(t("Common:Updated"));
      } else {
        await create.mutateAsync(toCounterInput(full, counters.length));
        toast.success(t("Common:Added"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  return (
    <AppDialog
      open={open}
      width={520}
      className="queue-counter-dialog"
      title={counter ? t("Queue:Form:EditTitle", counter.name) : t("Queue:Form:AddTitle")}
      canSave={
        name.trim().length > 0 &&
        Boolean(dentistId) &&
        PREFIX_PATTERN.test(prefix.trim().toUpperCase())
      }
      saving={create.isPending || update.isPending}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
        <Row gutter={[16, 14]}>
          <Col span={24}>
            <Form.Item
              name="name"
              label={t("Queue:Form:Name")}
              rules={[
                { required: true, whitespace: true, message: t("Queue:Counter:NameRequired") },
              ]}
            >
              <Input autoFocus maxLength={MAX_COUNTER_NAME} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <DentistPickerField
              counter={counter}
              otherCounters={counters.filter((c) => c.id !== counter?.id)}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="numberPrefix"
              label={t("Queue:Form:Prefix")}
              normalize={(value: string) => value.toUpperCase()}
              extra={t("Queue:Form:PrefixHint")}
              rules={[
                { required: true, message: t("Queue:Form:PrefixRequired") },
                { pattern: PREFIX_PATTERN, message: t("Queue:Form:PrefixInvalid") },
              ]}
            >
              <Input maxLength={2} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="startNumber"
              label={t("Queue:Form:StartNumber")}
              extra={t("Queue:Form:Display", previewNumber(prefix || "A", start))}
              rules={[{ ...POSITIVE, required: true, message: t("Queue:Form:PositiveNumber") }]}
              required={false}
            >
              <InputNumber min={1} precision={0} className="queue-form__number" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="waitWarningMinutes"
              label={t("Queue:Form:WaitWarning")}
              extra={t("Queue:Form:WaitWarningHint")}
              rules={[{ ...POSITIVE, required: true, message: t("Queue:Form:PositiveNumber") }]}
              required={false}
            >
              <InputNumber
                min={1}
                precision={0}
                className="queue-form__number queue-form__threshold"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="autoResetDaily"
              valuePropName="checked"
              className="queue-form__auto-reset"
            >
              <Checkbox>{t("Queue:Form:AutoReset")}</Checkbox>
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {counter && <CounterResetBox counter={counter} />}
    </AppDialog>
  );
}
