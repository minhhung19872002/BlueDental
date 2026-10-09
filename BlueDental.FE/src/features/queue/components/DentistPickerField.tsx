import { useMemo, useState } from "react";
import { Button, Form, Select, Tooltip } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useDentistStaffOptions } from "@/hooks/useStaffOptions";
import type { ServiceCounter } from "../types";
import { bareDentistName, dentistInitials } from "../utils/dentistName";

interface DentistPickerFieldProps {
  /** The counter being edited; null on a new counter. */
  counter: ServiceCounter | null;
  /** The branch's other counters — a dentist heads only one of them. */
  otherCounters: ServiceCounter[];
}

/**
 * "Bác sĩ phụ trách" (required): staff ticked "Bác sĩ". As soon as a dentist is
 * set — saved or just picked — the BA mock shows them as a locked card with
 * "Đổi bác sĩ…" under it; the picker only shows while none is set or after that
 * link. The link is shut while anyone waits at, or is being seen by, the
 * counter's saved dentist.
 */
export function DentistPickerField({ counter, otherCounters }: DentistPickerFieldProps) {
  return (
    <Form.Item
      name="dentistId"
      label={t("Queue:Form:Dentist")}
      rules={[{ required: true, message: t("Queue:Form:DentistRequired") }]}
    >
      <DentistControl counter={counter} otherCounters={otherCounters} />
    </Form.Item>
  );
}

interface DentistControlProps extends DentistPickerFieldProps {
  /** Injected by Form.Item; the id ties the label to the picker. */
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
}

function DentistControl({ counter, otherCounters, id, value, onChange }: DentistControlProps) {
  const { data: dentists, isLoading } = useDentistStaffOptions();
  const [picking, setPicking] = useState(false);

  const options = useMemo(() => {
    const heads = new Map(
      otherCounters.filter((c) => c.dentistId).map((c) => [c.dentistId, c.name]),
    );
    return (dentists ?? []).map((dentist) => {
      const heading = heads.get(dentist.value);
      return {
        value: dentist.value,
        label: heading ? t("Queue:Form:DentistTaken", dentist.label, heading) : dentist.label,
        disabled: Boolean(heading),
      };
    });
  }, [dentists, otherCounters]);

  // A dentist who is no longer ticked "Bác sĩ" is still named from the counter.
  const name =
    dentists?.find((dentist) => dentist.value === value)?.label ??
    (value && value === counter?.dentistId ? counter.dentistName : null);

  if (value && name && !picking) {
    const busy = value === counter?.dentistId && counter.inQueueCount > 0;
    return <FixedDentist name={name} busy={busy} onChange={() => setPicking(true)} />;
  }

  const handlePick = (picked: string) => {
    onChange?.(picked);
    setPicking(false);
  };

  return (
    <Select
      id={id}
      showSearch
      optionFilterProp="label"
      loading={isLoading}
      autoFocus={picking}
      defaultOpen={picking}
      placeholder={t("Queue:Form:DentistRequired")}
      options={options}
      value={value}
      onChange={handlePick}
      onBlur={() => setPicking(false)}
    />
  );
}

interface FixedDentistProps {
  name: string;
  busy: boolean;
  onChange: () => void;
}

function FixedDentist({ name, busy, onChange }: FixedDentistProps) {
  return (
    <>
      <div className="queue-form__dentist-card">
        <span className="queue-form__dentist-avatar" aria-hidden>
          {dentistInitials(name)}
        </span>
        <span className="bd-min0">
          <span className="queue-form__dentist-name">
            {t("Queue:Card:Dentist", bareDentistName(name))}
          </span>
          <span className="queue-form__dentist-sub">{t("Queue:Form:DentistFixed")}</span>
        </span>
        <LockOutlined className="queue-form__dentist-lock" aria-hidden />
      </div>
      <div className="queue-form__dentist-foot">
        <span>{t("Queue:Form:DentistChangeHint")}</span>
        <Tooltip title={busy ? t("Queue:Form:DentistLocked") : undefined}>
          <Button
            type="link"
            size="small"
            className="queue-form__change"
            disabled={busy}
            onClick={onChange}
          >
            {t("Queue:Form:ChangeDentist")}
          </Button>
        </Tooltip>
      </div>
    </>
  );
}
