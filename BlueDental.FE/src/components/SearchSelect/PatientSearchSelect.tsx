import { usePatientPicker, type PatientOption } from "@/hooks/usePatientOptions";
import { SearchSelect, type SearchSelectProps } from "./SearchSelect";

type PatientSearchSelectProps = Omit<SearchSelectProps, "options" | "onSearch" | "filterLocally"> & {
  /** Defaults to the reference's "[CODE] - NAME". */
  formatLabel?: (patient: PatientOption) => string;
};

const defaultLabel = (p: PatientOption) => `[${p.code}] - ${p.name.toUpperCase()}`;

/**
 * SearchSelect over the clinic's patients, searched on the server.
 *
 * The options are one page of patients, so the picked one is pinned in when the
 * page lacks it, and typing re-queries rather than filtering that page. Works
 * bare or inside FloatingField / Form.Item (value, onChange, onOpenChange).
 */
export function PatientSearchSelect({ formatLabel = defaultLabel, ...rest }: PatientSearchSelectProps) {
  const { patients, search } = usePatientPicker(rest.value);

  return (
    <SearchSelect
      {...rest}
      options={patients.map((p) => ({ value: p.id, label: formatLabel(p) }))}
      onSearch={search}
      filterLocally={false}
    />
  );
}
