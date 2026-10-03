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

/** The one appointment the dialog was opened for, from its row's clock icon. */
export interface HistoryAppointmentScope {
  id: string;
  startTime: string;
  endTime: string;
}

interface Props {
  open: boolean;
  patientId: string;
  /** Absent: every appointment of the patient, one week at a time. */
  appointment?: HistoryAppointmentScope | null;
  onClose: () => void;
}

const PAGE_SIZE = 20;

/** "03/10/2026 · 09:22 – 09:52" */
function slotLabel({ startTime, endTime }: HistoryAppointmentScope): string {
  const start = dayjs(startTime);
  return `${start.format("DD/MM/YYYY")} · ${start.format("HH:mm")} – ${dayjs(endTime).format("HH:mm")}`;
}

interface BodyProps {
  patientId: string;
  appointmentId: string | null;
}

/**
 * Everything inside the dialog. Mounted only while it is open, so the
 * history is fetched when someone asks for it, never behind a closed dialog.
 */
function AppointmentHistoryBody({ patientId, appointmentId }: BodyProps) {
  const filters = useHistoryFilters(patientId, appointmentId);
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
        showWeek={!appointmentId}
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

/**
 * Lịch sử thay đổi lịch hẹn, opened from the patient's Lịch hẹn tab: from the
 * toolbar for the whole patient, from a row's clock icon for that appointment.
 */
export function AppointmentHistoryModal({ open, patientId, appointment, onClose }: Props) {
  const subtitle = appointment
    ? t("Appointment:History:ModalSubtitleOne", slotLabel(appointment))
    : t("Appointment:History:ModalSubtitle");

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
            <h2 className="bd-modal-title ah-title">{t("Appointment:History:ModalTitle")}</h2>
            <p className="bd-modal-subtitle">{subtitle}</p>
          </div>
        </div>
      }
    >
      {open && <AppointmentHistoryBody patientId={patientId} appointmentId={appointment?.id ?? null} />}
    </Modal>
  );
}
