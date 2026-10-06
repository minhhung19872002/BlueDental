import { usePatientPicker, type PatientOption } from "@/hooks/usePatientOptions";
import { SearchSelect, type SearchSelectProps } from "./SearchSelect";

type PatientSearchSelectProps = Omit<
  SearchSelectProps,
  "options" | "onSearch" | "filterLocally" | "onLoadMore" | "loadingMore"
> & {
  /** Defaults to the reference's "[CODE] - NAME". */
  formatLabel?: (patient: PatientOption) => string;
};

const defaultLabel = (p: PatientOption) => `[${p.code}] - ${p.name.toUpperCase()}`;

/**
 * SearchSelect over the clinic's patients, searched on the server.
 *
 * The options are paged in as the list is scrolled, so the picked one is pinned
 * in when the loaded rows lack it, and typing re-queries rather than filtering
 * what is loaded. Works
 * bare or inside FloatingField / Form.Item (value, onChange, onOpenChange).
 */
export function PatientSearchSelect({ formatLabel = defaultLabel, ...rest }: PatientSearchSelectProps) {
  const { patients, search, hasMore, loadingMore, loadMore } = usePatientPicker(rest.value);

  return (
    <SearchSelect
      {...rest}
      options={patients.map((p) => ({ value: p.id, label: formatLabel(p) }))}
      onSearch={search}
      filterLocally={false}
      onLoadMore={hasMore ? loadMore : undefined}
      loadingMore={loadingMore}
    />
  );
}
