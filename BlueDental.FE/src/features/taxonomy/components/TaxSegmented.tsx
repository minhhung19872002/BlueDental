import { Segmented } from "antd";
import { t } from "@/lib/i18n";

/**
 * The "Trước thuế | Sau thuế" toggle. It stores a boolean but reads as two
 * words, so it translates between the two for whichever Form.Item holds it.
 */
export function TaxSegmented({
  value,
  onChange,
}: {
  value?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <Segmented
      value={value ? "after" : "before"}
      onChange={(next) => onChange?.(next === "after")}
      options={[
        { value: "before", label: t("Taxonomy:Service:BeforeTax") },
        { value: "after", label: t("Taxonomy:Service:AfterTax") },
      ]}
    />
  );
}
