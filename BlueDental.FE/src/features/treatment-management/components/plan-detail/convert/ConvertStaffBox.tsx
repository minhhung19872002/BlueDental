import { Plus, X } from "lucide-react";
import { FloatingLabel } from "@/components/FloatingLabel";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useDentistOptions, useStaffOptionsSearch } from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";

interface PairProps {
  label: string;
  secondLabel: string;
  useOptions: typeof useStaffOptionsSearch;
  value: string | null;
  second: string | null;
  error?: string;
  onChange: (value: string | null) => void;
  onSecondChange: (value: string | null) => void;
}

/**
 * One required picker, with a second one the "+" reveals and the red "×"
 * takes away again — the reference pairs its doctors and its consultants
 * exactly like this.
 */
function StaffPair({
  label,
  secondLabel,
  useOptions,
  value,
  second,
  error,
  onChange,
  onSecondChange,
}: PairProps) {
  return (
    <>
      <div className="cvt-staff-row">
        <FloatingLabel label={label} floated={Boolean(value)} required>
          <ServerSearchSelect
            aria-label={label}
            value={value ?? undefined}
            useOptions={useOptions}
            onChange={(picked) => onChange(picked ?? null)}
          />
        </FloatingLabel>
        {second === null && (
          <button
            type="button"
            className="cvt-staff-add"
            aria-label={t("Thêm {0}", secondLabel)}
            onClick={() => onSecondChange("")}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && <p className="cvt-error">{error}</p>}
      {second !== null && (
        <div className="cvt-staff-row">
          <FloatingLabel label={secondLabel} floated={Boolean(second)}>
            <ServerSearchSelect
              aria-label={secondLabel}
              value={second || undefined}
              useOptions={useOptions}
              onChange={(picked) => onSecondChange(picked ?? "")}
            />
          </FloatingLabel>
          <button
            type="button"
            className="cvt-staff-add cvt-staff-add--remove"
            aria-label={t("Bỏ {0}", secondLabel)}
            onClick={() => onSecondChange(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}

interface Props {
  diagnoserId: string | null;
  secondDiagnoserId: string | null;
  consultantId: string | null;
  secondConsultantId: string | null;
  errors: { diagnoser?: string; consultant?: string };
  onDiagnoser: (value: string | null) => void;
  onSecondDiagnoser: (value: string | null) => void;
  onConsultant: (value: string | null) => void;
  onSecondConsultant: (value: string | null) => void;
}

/** The tinted box holding the conversion's diagnosing doctors and consultants. */
export function ConvertStaffBox({
  diagnoserId,
  secondDiagnoserId,
  consultantId,
  secondConsultantId,
  errors,
  onDiagnoser,
  onSecondDiagnoser,
  onConsultant,
  onSecondConsultant,
}: Props) {
  return (
    <div className="cvt-staff-box">
      <StaffPair
        label={t("Bác sĩ chẩn đoán 1")}
        secondLabel={t("Chẩn đoán 2")}
        useOptions={useDentistOptions}
        value={diagnoserId}
        second={secondDiagnoserId}
        error={errors.diagnoser}
        onChange={onDiagnoser}
        onSecondChange={onSecondDiagnoser}
      />
      <StaffPair
        label={t("Nhân sự tư vấn 1")}
        secondLabel={t("Nhân sự tư vấn 2")}
        useOptions={useStaffOptionsSearch}
        value={consultantId}
        second={secondConsultantId}
        error={errors.consultant}
        onChange={onConsultant}
        onSecondChange={onSecondConsultant}
      />
    </div>
  );
}
