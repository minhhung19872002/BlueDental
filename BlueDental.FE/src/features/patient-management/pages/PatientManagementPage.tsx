import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import { useServiceGroupOptions } from "@/hooks/useServiceGroupOptions";
import { useDentistStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { useBranchFilter } from "@/lib/clinicBranch";
import { patientApi } from "../api/patientApi";
import { usePatientDto, usePatientList } from "../api/patientQueries";
import { usePatientListFilters } from "../hooks/usePatientListFilters";
import { useNationalIdScan } from "../hooks/useNationalIdScan";
import { NationalIdScanDialog } from "../components/scan-id/NationalIdScanDialog";
import type { PatientPrefill } from "../types/patient";
import { PatientEditorDialog } from "../components/PatientEditorDialog";
import { PatientListFilters } from "../components/PatientListFilters";
import { PatientListToolbar } from "../components/PatientListToolbar";
import { PatientStickyToolbar } from "../components/PatientStickyToolbar";
import { PatientTable } from "../components/PatientTable";
import "../components/patient.css";

/**
 * Which record the dialog is on: none, a new one (maybe filled from a scanned
 * CCCD), or the one being edited.
 */
type Editing =
  | { mode: "closed" }
  | { mode: "create"; prefill?: PatientPrefill }
  | { mode: "edit"; id: string };

/**
 * Danh sách bệnh nhân — /patient.
 *
 * Container: it owns the filters, asks for the page they describe, and hands
 * the rows to presentational pieces. See docs/clone/pages/patient-list.md.
 */
export function PatientManagementPage() {
  const branchId = useBranchFilter();
  const filters = usePatientListFilters();
  const { setPeriod, clearFilters, setFilters } = filters;
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const [exporting, setExporting] = useState(false);
  const ability = useAbility("patient");

  // The compact toolbar takes over once the real one has scrolled under the
  // app header, which is what the header's own height is doing here.
  const { sentinelRef, past } = useScrolledPast("-72px 0px 0px 0px");

  // Typing narrows the list; without the pause every keystroke is a round trip.
  const debouncedKeyword = useDebounce(filters.filters.keyword, 400);

  const query = usePatientList({
    ...filters.toQuery(),
    filter: debouncedKeyword.trim() || undefined,
    branchId,
    skipCount: (filters.page - 1) * filters.pageSize,
    maxResultCount: filters.pageSize,
  });

  const dentists = useDentistStaffOptions();
  const serviceGroups = useServiceGroupOptions();
  const tags = usePatientTagOptions();

  const options = useMemo(
    () => ({
      doctors: dentists.data ?? [],
      serviceGroups: serviceGroups.data ?? [],
      tags: tags.data ?? [],
    }),
    [dentists.data, serviceGroups.data, tags.data],
  );

  const editingPatient = usePatientDto(editing.mode === "edit" ? editing.id : "");

  const handleExport = async () => {
    setExporting(true);
    try {
      await patientApi.exportExcel({
        ...filters.toQuery(),
        filter: debouncedKeyword.trim() || undefined,
        branchId,
      });
    } catch (error) {
      notifyError(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const closeDialog = () => setEditing({ mode: "closed" });
  const openCreate = () => setEditing({ mode: "create" });

  // Quét CCCD: a card already on file narrows the list to its record (TH1);
  // a new one opens "Tạo hồ sơ" filled from the card (TH2).
  const handleExistingId = useCallback(
    (nationalId: string) => {
      setPeriod({ mode: null, anchor: new Date() });
      clearFilters();
      setFilters({ keyword: nationalId });
      toast.info(t("Patient:ScanId:AlreadyExists"));
    },
    [setPeriod, clearFilters, setFilters],
  );
  const handleNewId = useCallback(
    (prefill: PatientPrefill) => setEditing({ mode: "create", prefill }),
    [],
  );
  const scan = useNationalIdScan({ onExisting: handleExistingId, onNew: handleNewId });

  // The edit dialog waits for the record: opening it empty would show "Tạo hồ
  // sơ" for a moment and ask the server for a code the patient already has.
  const dialogPatient = editing.mode === "edit" ? editingPatient.data ?? null : null;
  const dialogOpen = editing.mode === "create" || Boolean(dialogPatient);

  return (
    <div className="bd-patient-page">
      <PatientStickyToolbar
        visible={past}
        period={filters.period}
        filters={filters.filters}
        options={options}
        exporting={exporting}
        canExport={ability.canExport}
        canCreate={ability.canCreate}
        onPeriodChange={filters.setPeriod}
        onApplyFilters={filters.setFilters}
        onClearFilters={filters.clearFilters}
        onExport={() => void handleExport()}
        onCreate={openCreate}
        onScanId={scan.openScan}
      />

      {/* Marks the top of the page for the compact toolbar above. It is taken
          out of the flow so it costs neither height nor a column gap. */}
      <div ref={sentinelRef} className="bd-patient-sentinel" aria-hidden="true" />

      <PageHeader
        title={t("Patient:List:Title")}
        subtitle={t("Patient:List:RecordCount", query.data?.totalCount ?? 0)}
      />

      <PatientListToolbar
        keyword={filters.filters.keyword}
        period={filters.period}
        exporting={exporting}
        canExport={ability.canExport}
        canCreate={ability.canCreate}
        onKeywordChange={(keyword) => filters.setFilters({ keyword })}
        onPeriodChange={filters.setPeriod}
        onExport={() => void handleExport()}
        onCreate={openCreate}
        onScanId={scan.openScan}
      />

      <PatientListFilters
        filters={filters.filters}
        options={options}
        onChange={filters.setFilters}
      />

      <PatientTable
        rows={query.data?.items ?? []}
        totalCount={query.data?.totalCount ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        loading={query.isFetching}
        narrowed={filters.isNarrowed || filters.period.mode !== null}
        onPageChange={filters.setPage}
        onPageSizeChange={filters.setPageSize}
        onEdit={(row) => setEditing({ mode: "edit", id: row.id })}
      />

      {/* Mounted only once there is something to edit, so the dialog's own
          lookups are not fetched on a screen nobody has opened. */}
      {dialogOpen && (
        <PatientEditorDialog
          open
          patient={dialogPatient}
          prefill={editing.mode === "create" ? editing.prefill : undefined}
          onClose={closeDialog}
        />
      )}

      {scan.open && (
        <NationalIdScanDialog
          state={scan.state}
          onRead={scan.read}
          onRescan={scan.rescan}
          onConfirm={scan.confirm}
          onClose={scan.close}
        />
      )}
    </div>
  );
}
