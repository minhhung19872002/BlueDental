import { t } from "@/lib/i18n";

interface CarePatientLineProps {
  /** Omitted in the Gửi ZBS dialog, whose bar shows the name alone. */
  code?: string;
  name: string;
  /** Line prefix — "Họ và tên" everywhere except Gửi ZBS's "Khách hàng". */
  label?: string;
  /** The message and care-result dialogs draw this line as a tinted bar. */
  tinted?: boolean;
}

/** "Họ và tên: [MÃ] - TÊN" header line the care dialogs open with. */
export function CarePatientLine({ code, name, label, tinted }: CarePatientLineProps) {
  return (
    <div className={tinted ? "cskh-patient-bar" : undefined}>
      {label ?? t("Họ và tên")}:{" "}
      <strong>{code !== undefined ? `[${code}] - ${name}` : name}</strong>
    </div>
  );
}
