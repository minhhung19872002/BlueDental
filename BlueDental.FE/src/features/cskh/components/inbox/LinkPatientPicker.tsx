import { useState } from "react";
import { t } from "@/lib/i18n";
import { SearchSelect } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useInboxPatients, useLinkPatient } from "../../api/inboxApi";

/**
 * Ties the Zalo user to the branch's record when Zalo could not: the user
 * shared no phone, or two records hold it. Found by name, file code or phone.
 */
export function LinkPatientPicker({ conversationId, onDone }: { conversationId: string; onDone?: () => void }) {
  const [keyword, setKeyword] = useState("");
  const debounced = useDebounce(keyword.trim(), 300);
  const patients = useInboxPatients(debounced, debounced.length > 0);
  const link = useLinkPatient();

  const options = debounced
    ? (patients.data ?? []).map((item) => ({
        value: item.id,
        label: [`[${item.code}] - ${item.name}`, item.phone].filter(Boolean).join(" · "),
      }))
    : [];

  const handleChange = (patientId: string | undefined) => {
    if (patientId) link.mutate({ id: conversationId, patientId }, { onSuccess: onDone });
  };

  return (
    <div className="ibx-link">
      <SearchSelect
        value={undefined}
        options={options}
        placeholder={t("CSKH:Inbox:LinkFind")}
        filterLocally={false}
        loading={patients.isFetching || link.isPending}
        emptyText={debounced ? t("CSKH:Send:NoCustomerFound") : t("CSKH:Send:FindCustomerHint")}
        onSearch={setKeyword}
        onChange={handleChange}
      />
    </div>
  );
}
