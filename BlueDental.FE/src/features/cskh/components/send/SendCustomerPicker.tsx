import { useState } from "react";
import { t } from "@/lib/i18n";
import { SearchSelect } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useSendCustomers } from "../../api/sendApi";

/**
 * Khách lẻ: find a customer by name, file code or phone and add them to the
 * send. The box clears itself after each pick, so several can be added in a row.
 */
export function SendCustomerPicker({ onAdd }: { onAdd: (patientId: string) => void }) {
  const [keyword, setKeyword] = useState("");
  const debounced = useDebounce(keyword.trim(), 300);
  const customers = useSendCustomers(debounced, debounced.length > 0);

  const options = debounced
    ? (customers.data ?? []).map((item) => ({
        value: item.patientId,
        label: [`[${item.code}] - ${item.name}`, item.phone].filter(Boolean).join(" · "),
      }))
    : [];

  const handleChange = (patientId: string | undefined) => {
    if (patientId) onAdd(patientId);
  };

  return (
    <div className="snd-picker">
      <SearchSelect
        value={undefined}
        options={options}
        placeholder={t("CSKH:Send:FindCustomer")}
        filterLocally={false}
        loading={customers.isFetching}
        emptyText={debounced ? t("CSKH:Send:NoCustomerFound") : t("CSKH:Send:FindCustomerHint")}
        onSearch={setKeyword}
        onChange={handleChange}
      />
    </div>
  );
}
