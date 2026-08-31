import { useState, useMemo, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CalendarUnderlineTabs } from "../components/CalendarUnderlineTabs";
import { CalendarToolbarRow1 } from "../components/CalendarToolbarRow1";
import { CalendarToolbarRow2 } from "../components/CalendarToolbarRow2";
import { DayViewGrid, type DayViewDoctor } from "../components/DayViewGrid";
import { WeekViewCalendar } from "../components/WeekViewCalendar";
import { MonthViewCalendar } from "../components/MonthViewCalendar";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { TempAppointmentEditorModal } from "../components/TempAppointmentEditorModal";
import { CalendarFabs } from "../components/CalendarFabs";
import { CalendarControlPanel } from "../components/CalendarControlPanel";
import { TimekeepingBoard } from "@/features/timekeeping/components/TimekeepingBoard";
import { WorkScheduleBuilder } from "@/features/timekeeping/components/WorkScheduleBuilder";
import { useCalendarState } from "../hooks/useCalendarState";
import { useCalendarFilters } from "../hooks/useCalendarFilters";
import { useStatusCounts } from "../hooks/useStatusCounts";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useAppointmentList } from "../api/appointmentQueries";
import { useDeleteAppointment, useDeleteManyAppointments } from "../api/appointmentMutations";
import { exportToExcel } from "@/utils/exportExcel";
import { t } from "@/lib/i18n";
import "../components/calendar.css";

export function AppointmentCalendarPage() {
  const state = useCalendarState();
  const filters = useCalendarFilters();
  const { data: dentistData } = useDentistList();
  const doctors: DayViewDoctor[] = useMemo(
    () => (dentistData ?? []).map((d) => ({ id: d.id, name: d.name })),
    [dentistData],
  );

  const { data: dayAppointments } = useAppointmentList({
    date: state.currentDate.format("YYYY-MM-DD"),
    maxResultCount: 500,
  });
  const counts = useStatusCounts(dayAppointments?.items ?? []);

  const [addOpen, setAddOpen] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTempId, setEditTempId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<"single" | "multi" | null>(null);
  const [deleteSingleId, setDeleteSingleId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (fullscreen) {
      document.body.classList.add("cal-fullscreen");
    } else {
      document.body.classList.remove("cal-fullscreen");
      setPanelOpen(false);
    }
    return () => document.body.classList.remove("cal-fullscreen");
  }, [fullscreen]);

  const deleteMutation = useDeleteAppointment();
  const deleteManyMutation = useDeleteManyAppointments();

  const handleExport = () => {
    exportToExcel(
      dayAppointments?.items ?? [],
      [
        { header: t("Bệnh nhân"), key: "patientName" },
        { header: t("Bác sĩ"), key: "doctorName" },
        { header: t("Bắt đầu"), key: "startTime", format: (v) => (v ? dayjs(String(v)).format("DD/MM/YYYY HH:mm") : "") },
        { header: t("Kết thúc"), key: "endTime", format: (v) => (v ? dayjs(String(v)).format("HH:mm") : "") },
        { header: t("Trạng thái"), key: "status" },
        { header: t("Lý do"), key: "reason" },
      ],
      `lich-hen-${state.currentDate.format("YYYY-MM-DD")}`,
    );
  };

  const handleCellClick = (doctorId: string, slotIndex: number) => {
    setInitialDate(state.currentDate.format("YYYY-MM-DD"));
    setAddOpen(true);
    void doctorId;
    void slotIndex;
  };

  const handleDeleteSingle = useCallback((id: string) => {
    setDeleteSingleId(id);
    setDeleteTarget("single");
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteTarget("multi");
  }, [selectedIds.size]);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTarget === "single" && deleteSingleId) {
      await deleteMutation.mutateAsync(deleteSingleId);
      toast.success(t("Đã xoá lịch hẹn"));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteSingleId);
        return next;
      });
    } else if (deleteTarget === "multi") {
      const ids = [...selectedIds];
      await deleteManyMutation.mutateAsync(ids);
      toast.success(t("Đã xoá {0} lịch hẹn").replace("{0}", String(ids.length)));
      setSelectedIds(new Set());
    }
    setDeleteTarget(null);
    setDeleteSingleId(null);
  }, [deleteTarget, deleteSingleId, selectedIds, deleteMutation, deleteManyMutation]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setDeleteSingleId(null);
  }, []);

  const handleCardAction = useCallback((action: string, id: string) => {
    switch (action) {
      case "edit": {
        const appt = dayAppointments?.items?.find((a) => a.id === id);
        if (appt?.isTemporary) {
          setEditTempId(id);
          setTempOpen(true);
        } else {
          setEditId(id);
          setAddOpen(true);
        }
        break;
      }
      case "select-delete":
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        break;
      case "deselect":
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        break;
      case "delete":
        handleDeleteSingle(id);
        break;
    }
  }, [handleDeleteSingle, dayAppointments]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return (
    <>
      <div className="cal-page">
        <CalendarUnderlineTabs
          activeTab={state.topTab}
          onChange={state.setTopTab}
        />

        {state.topTab === "customer" && (
          <>
            <CalendarToolbarRow1
              viewMode={state.viewMode}
              onViewModeChange={state.setViewMode}
              currentDate={state.currentDate}
              onDateChange={(d) => state.setCurrentDate(() => d)}
              onNavigate={state.navigateDate}
              counts={counts}
              statusFilter={filters.statusFilter}
              onStatusToggle={filters.toggleStatus}
            />

            <CalendarToolbarRow2
              keyword={filters.keyword}
              onKeywordChange={filters.setKeyword}
              doctorIds={filters.doctorIds}
              onDoctorChange={filters.setDoctorIds}
              doctors={doctors}
              viewMode={state.viewMode}
              slotMinutes={filters.slotMinutes}
              onToggleSlot={filters.toggleSlotMinutes}
              onExport={handleExport}
              onCreateAppointment={() => { setEditId(null); setAddOpen(true); }}
              onCreateTemp={() => setTempOpen(true)}
              onFullscreen={() => setFullscreen(true)}
            />

            {selectedIds.size > 0 && (
              <div className="cal-selection-bar">
                <span className="cal-selection-label">
                  {t("Đã chọn {0} lịch hẹn").replace("{0}", String(selectedIds.size))}
                </span>
                <div className="cal-selection-actions">
                  <button
                    type="button"
                    className="cal-selection-btn"
                    onClick={handleClearSelection}
                  >
                    {t("Bỏ chọn")}
                  </button>
                  <button
                    type="button"
                    className="cal-selection-btn cal-selection-btn--danger"
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending || deleteManyMutation.isPending}
                  >
                    {t("Xoá {0} mục").replace("{0}", String(selectedIds.size))}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {state.topTab === "customer" ? (
          <div className="cal-grid-wrap">
            {state.viewMode === "day" && (
              <DayViewGrid
                currentDate={state.currentDate}
                doctors={doctors}
                slotMinutes={filters.slotMinutes}
                keyword={filters.keyword}
                doctorIds={filters.doctorIds}
                statusFilter={filters.statusFilter}
                selectedIds={selectedIds}
                onCellClick={handleCellClick}
                onCardAction={handleCardAction}
              />
            )}
            {state.viewMode === "week" && (
              <WeekViewCalendar
                currentDate={state.currentDate}
                slotMinutes={filters.slotMinutes}
                keyword={filters.keyword}
                doctorIds={filters.doctorIds}
                statusFilter={filters.statusFilter}
                selectedIds={selectedIds}
                onCellClick={(dayIdx, slotIdx) => {
                  setInitialDate(
                    state.currentDate.startOf("week").add(dayIdx, "day").format("YYYY-MM-DD"),
                  );
                  setEditId(null);
                  setAddOpen(true);
                  void slotIdx;
                }}
                onCardAction={handleCardAction}
              />
            )}
            {state.viewMode === "month" && (
              <MonthViewCalendar
                currentDate={state.currentDate}
                keyword={filters.keyword}
                doctorIds={filters.doctorIds}
                statusFilter={filters.statusFilter}
                onDayClick={(day) => {
                  state.setCurrentDate(() => day);
                  state.setViewMode("day");
                }}
              />
            )}
          </div>
        ) : state.workSchedule === "builder" ? (
          <WorkScheduleBuilder
            currentDate={state.currentDate}
            onBack={() => state.setWorkSchedule(null)}
          />
        ) : (
          <TimekeepingBoard
            currentDate={state.currentDate}
            viewMode={state.viewMode}
            onViewModeChange={state.setViewMode}
            onDateChange={(d) => state.setCurrentDate(() => d)}
            onOpenBuilder={() => state.setWorkSchedule("builder")}
          />
        )}
      </div>

      <AppointmentEditorModal
        open={addOpen}
        appointmentId={editId}
        initialDate={initialDate}
        onClose={() => { setAddOpen(false); setEditId(null); }}
        onSuccess={() => { setAddOpen(false); setEditId(null); }}
      />

      <TempAppointmentEditorModal
        open={tempOpen}
        appointmentId={editTempId}
        initialDate={state.currentDate.format("YYYY-MM-DD")}
        onClose={() => { setTempOpen(false); setEditTempId(null); }}
        onSuccess={() => { setTempOpen(false); setEditTempId(null); }}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        noun={t("lịch hẹn")}
        name={
          deleteTarget === "multi"
            ? t("{0} mục").replace("{0}", String(selectedIds.size))
            : t("này")
        }
        pending={deleteMutation.isPending || deleteManyMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={handleCancelDelete}
      />

      {fullscreen && (
        <>
          <CalendarFabs
            onExitFullscreen={() => setFullscreen(false)}
            onCreateTemp={() => setTempOpen(true)}
            onCreateAppointment={() => { setEditId(null); setAddOpen(true); }}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            filterCount={filters.filterCount}
          />
          <CalendarControlPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            viewMode={state.viewMode}
            onViewModeChange={state.setViewMode}
            currentDate={state.currentDate}
            onDateChange={(d) => state.setCurrentDate(() => d)}
            onNavigate={state.navigateDate}
            slotMinutes={filters.slotMinutes}
            onToggleSlot={filters.toggleSlotMinutes}
            onCreateAppointment={() => { setEditId(null); setAddOpen(true); }}
            onCreateTemp={() => setTempOpen(true)}
            onExport={handleExport}
            keyword={filters.keyword}
            onKeywordChange={filters.setKeyword}
            doctorIds={filters.doctorIds}
            onDoctorChange={filters.setDoctorIds}
            doctors={doctors}
            counts={counts}
            statusFilter={filters.statusFilter}
            onStatusToggle={filters.toggleStatus}
            filterCount={filters.filterCount}
            onClearFilters={filters.clearAll}
          />
        </>
      )}
    </>
  );
}
