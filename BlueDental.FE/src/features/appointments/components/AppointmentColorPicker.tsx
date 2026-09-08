import { t } from "@/lib/i18n";

const APPT_COLORS = [
  { value: "#6366f1", labelKey: "Tím" },
  { value: "#22C55E", labelKey: "Xanh lá" },
  { value: "#F59E0B", labelKey: "Cam" },
  { value: "#EF4444", labelKey: "Đỏ" },
] as const;

interface Props {
  value?: string;
  onChange: (color: string) => void;
}

export function AppointmentColorPicker({ value, onChange }: Props) {
  const selected = value || APPT_COLORS[0].value;

  return (
    <div className="appt-field">
      <span className="appt-field-label">{t("Màu lịch hẹn")}</span>
      <div className="appt-color-row">
        {APPT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={t(c.labelKey)}
            className={[
              "appt-color-swatch",
              selected === c.value && "appt-color-swatch--selected",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--swatch-color": c.value } as React.CSSProperties}
            onClick={() => onChange(c.value)}
          />
        ))}
      </div>
    </div>
  );
}

export { APPT_COLORS };
