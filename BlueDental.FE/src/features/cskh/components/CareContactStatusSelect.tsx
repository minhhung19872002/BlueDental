import { Select } from "antd";
import { t } from "@/lib/i18n";
import { CARE_STATUS, type CareStatus } from "../api/careApi";

type ContactValue = "done" | "todo";

interface CareContactStatusSelectProps {
  status: CareStatus;
  pending: boolean;
  disabled: boolean;
  onChange: (contacted: boolean) => void;
}

/** Đã liên hệ / Chưa liên hệ of a Sau điều trị row; each change is logged server-side. */
export function CareContactStatusSelect({ status, pending, disabled, onChange }: CareContactStatusSelectProps) {
  const contacted = status === CARE_STATUS.Contacted;
  return (
    <Select<ContactValue>
      size="small"
      aria-label={t("CSKH:Col:Status")}
      className={[
        "cskh-contact-select",
        contacted ? "cskh-contact-select--done" : "cskh-contact-select--todo",
      ].join(" ")}
      popupMatchSelectWidth={false}
      value={contacted ? "done" : "todo"}
      loading={pending}
      disabled={disabled || pending}
      options={[
        { value: "todo", label: t("CSKH:Contact:NotYet") },
        { value: "done", label: t("CSKH:Contact:Done") },
      ]}
      onChange={(value) => onChange(value === "done")}
    />
  );
}
