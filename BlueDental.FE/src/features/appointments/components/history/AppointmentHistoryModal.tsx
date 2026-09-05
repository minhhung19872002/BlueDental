import { useCallback, useState } from "react";
import { Modal } from "antd";
import dayjs from "dayjs";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import {
  useAppointmentHistoryStats,
  useExportAppointmentHistory,
} from "../../api/appointmentHistoryQueries";
import { exportHistory, type HistoryExportFormat } from "./historyExport";
import type { HistoryView } from "./historyLabels";
import { HistoryEmpty } from "./HistoryEmpty";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryFooter } from "./HistoryFooter";
import { HistoryStatCards } from "./HistoryStatCards";
import { HistoryTable } from "./HistoryTable";
import { HistoryTimeline } from "./HistoryTimeline";
import { HistoryToolbar } from "./HistoryToolbar";
import { useHistoryData } from "./useHistoryData";
import { useHistoryFilters, type HistoryFilterValues } from "./useHistoryFilters";
import "./appointment-history.css";

interface Props {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

/**
 * Everything inside the dialog. Mounted only while it is open, so the
 * history is fetched when someone asks for it, never behind a closed dialog.
 */
function AppointmentHistoryBody({ patientId }: { patientId: string }) {
  const filters = useHistoryFilters(patientId);
  const pagination = useTablePagination(PAGE_SIZE);
  const [view, setView] = useState<HistoryView>("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const paging = { skipCount: pagination.skipCount, maxResultCount: pagination.maxResultCount };
  const data = useHistoryData(filters.filter, paging, view);
  const stats = useAppointmentHistoryStats(filters.filter);
  const exporter = useExportAppointmentHistory();

  const { resetToFirstPage } = pagination;
  const { patch, clear } = filters;

  const handleFilterChange = useCallback(
    (change: Partial<HistoryFilterValues>) => {
      patch(change);
      resetToFirstPage();
      setExpandedId(null);
    },
    [patch, resetToFirstPage],
  );

  const handleClear = useCallback(() => {
    clear();
    resetToFirstPage();
    setExpandedId(null);
  }, [clear, resetToFirstPage]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const handlePageChange = (page: number, pageSize: number) => {
    pagination.buildConfig().onChange?.(page, pageSize);
    setExpandedId(null);
  };

  const handleExport = useCallback(
    async (format: HistoryExportFormat) => {
      const rows = await exporter.mutateAsync(filters.filter);
      exportHistory(rows, format, `lich-su-lich-hen-${dayjs().format("YYYYMMDD-HHmm")}`);
    },
    [exporter, filters.filter],
  );

  const isEmpty = !data.loading && data.total === 0;

  return (
    <div className="ah-body">
      <HistoryStatCards stats={stats.data} />
      <HistoryFilterBar
        values={filters.values}
        dirty={filters.isDirty}
        onChange={handleFilterChange}
        onClear={handleClear}
      />
      <HistoryToolbar
        view={view}
        exporting={exporter.isPending}
        onViewChange={setView}
        onExport={handleExport}
      />
      {/* The bordered panel takes whatever height is left; the rows scroll
          inside it and the footer stays on its bottom edge. With nothing to
          show it shrinks to the reference empty card, no header, no pager. */}
      {isEmpty && <HistoryEmpty />}
      <div className="ah-panel" hidden={isEmpty}>
        <div className="ah-panel-scroll">
          {view === "table" ? (
            <HistoryTable
              entries={data.entries}
              loading={data.loading}
              expandedId={expandedId}
              onToggle={handleToggle}
            />
          ) : (
            <HistoryTimeline
              entries={data.entries}
              loading={data.loading}
              expandedId={expandedId}
              onToggle={handleToggle}
              hasMore={data.hasMore}
              loadingMore={data.loadingMore}
              onLoadMore={data.loadMore}
            />
          )}
        </div>
        {view === "table" ? (
          <HistoryFooter
            view="table"
            total={data.total}
            page={pagination.page}
            pageSize={pagination.pageSize}
            onChange={handlePageChange}
          />
        ) : (
          <HistoryFooter view="timeline" shown={data.entries.length} />
        )}
      </div>
    </div>
  );
}

/** Lịch sử thay đổi lịch hẹn, opened from the patient's Lịch hẹn tab. */
export function AppointmentHistoryModal({ open, patientId, onClose }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width="calc(100vw - 32px)"
      className="app-dialog ah-modal"
      title={
        <div className="bd-modal-head">
          <div>
            <h2 className="bd-modal-title ah-title">{t("Lịch sử thay đổi lịch hẹn")}</h2>
            <p className="bd-modal-subtitle">{t("Toàn bộ thao tác CR/Edit/Delete cho bệnh nhân này.")}</p>
          </div>
        </div>
      }
    >
      {open && <AppointmentHistoryBody patientId={patientId} />}
    </Modal>
  );
}
