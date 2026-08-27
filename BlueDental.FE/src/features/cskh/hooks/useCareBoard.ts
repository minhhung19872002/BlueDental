import { useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import {
  exportCareExcel,
  useCareRecordList,
  useCareStats,
  useUpdateCareRecord,
  type CareRecordDto,
  type CareStatus,
  type GetCareRecordListInput,
} from "../api/careApi";
import { careDateRange, type CareDateMode, type CareTabConfig } from "../careTabs";
import type { CareCounterKey } from "../components/CareCounters";

export type CareDialogKind = "create" | "result" | "send" | "message";

interface UseCareBoardArgs {
  branchId: string;
  tab: CareTabConfig;
  mode: CareDateMode;
  date: Dayjs;
}

/** State + queries behind one care-type tab of the board. */
export function useCareBoard({ branchId, tab, mode, date }: UseCareBoardArgs) {
  const [counter, setCounter] = useState<CareCounterKey>("total");
  const [status, setStatus] = useState<CareStatus | undefined>();
  const [search, setSearch] = useState("");
  const [doctorId, setDoctorId] = useState<string | undefined>();
  const [careStaffId, setCareStaffId] = useState<string | undefined>();
  const pagination = useTablePagination(20);
  const [exporting, setExporting] = useState(false);
  const [dialog, setDialog] = useState<CareDialogKind | null>(null);
  const [selected, setSelected] = useState<CareRecordDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const { fromDate, toDate } = careDateRange(mode, date);

  // Changing tab/date scope resets the transient filters, like the reference.
  useEffect(() => {
    setCounter("total");
    setStatus(undefined);
    pagination.resetToFirstPage();
  }, [tab.key, mode, fromDate]);

  const baseParams: GetCareRecordListInput = {
    branchId,
    type: tab.type,
    fromDate,
    toDate,
    assignedStaffId: doctorId,
    careStaffId,
    filter: debouncedSearch || undefined,
  };

  // Reference behaviour: counters refetch the list only — stats stay put.
  const stats = useCareStats({ branchId, type: tab.type, fromDate, toDate });
  const list = useCareRecordList({
    ...baseParams,
    status,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const updateCare = useUpdateCareRecord();

  const handleCounterChange = (key: CareCounterKey, next: CareStatus | undefined) => {
    setCounter(key);
    setStatus(next);
    pagination.resetToFirstPage();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCareExcel({ ...baseParams, status });
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const handleNote = async (record: CareRecordDto, note: string) => {
    try {
      await updateCare.mutateAsync({
        id: record.id,
        subject: record.subject,
        description: note || undefined,
        assignedStaffId: record.assignedStaffId ?? undefined,
        careStaffId: record.careStaffId ?? undefined,
        dueAt: record.dueAt ?? undefined,
        scheduledStart: record.scheduledStart ?? undefined,
        scheduledEnd: record.scheduledEnd ?? undefined,
        status: record.status,
        stageIds: record.stageIds,
      });
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const openDialog = (kind: CareDialogKind, record: CareRecordDto | null = null) => {
    setSelected(record);
    setDialog(kind);
  };

  const closeDialog = () => setDialog(null);

  return {
    counter,
    search,
    doctorId,
    careStaffId,
    pagination,
    exporting,
    dialog,
    selected,
    stats,
    list,
    setSearch: (value: string) => {
      setSearch(value);
      pagination.resetToFirstPage();
    },
    setDoctorId: (value: string | undefined) => {
      setDoctorId(value);
      pagination.resetToFirstPage();
    },
    setCareStaffId: (value: string | undefined) => {
      setCareStaffId(value);
      pagination.resetToFirstPage();
    },
    handleCounterChange,
    handleExport,
    handleNote,
    handleCall: () => toast.error(t("Chưa có cấu hình tổng đài gọi điện")),
    openDialog,
    closeDialog,
  };
}
