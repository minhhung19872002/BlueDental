import { useState, useMemo, useCallback, useEffect } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { MobileFilterDrawer } from "@/components/MobileFilterDrawer";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
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
import { useAbility } from "@/hooks/useAbility";
import { useCalendarState } from "../hooks/useCalendarState";
import { useCalendarFilters } from "../hooks/useCalendarFilters";
import { useStatusCounts } from "../hooks/useStatusCounts";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useAppointmentList } from "../api/appointmentQueries";
import { useDeleteAppointment, useDeleteManyAppointments } from "../api/appointmentMutations";
import { exportToExcel } from "@/utils/exportExcel";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";
import "../components/calendar.css";

export function AppointmentCalendarPage() {
  const ability = useAbility("appointment");
  const state = useCalendarState();
  const filters = useCalendarFilters();
  const { data: dentistData } = useDentistList();
  const doctors: DayViewDoctor[] = useMemo(
    () => (dentistData ?? []).map((d) => ({ id: d.id, name: d.name })),
    [dentistData],
  );

  const statsQuery = useMemo(() => {
    if (state.viewMode === "week") {
      const weekStart = state.currentDate.startOf("week");
      return {
        fromDate: weekStart.format("YYYY-MM-DD"),
        toDate: weekStart.add(6, "day").format("YYYY-MM-DD"),
        maxResultCount: 500,
      };
    }
    if (state.viewMode === "month") {
      const monthStart = state.currentDate.startOf("month");
      const monthEnd = state.currentDate.endOf("month");
      return {
        fromDate: monthStart.startOf("week").format("YYYY-MM-DD"),
        toDate: monthEnd.endOf("week").format("YYYY-MM-DD"),
        maxResultCount: 1000,
      };
    }
    return { date: state.currentDate.format("YYYY-MM-DD"), maxResultCount: 500 };
  }, [state.viewMode, state.currentDate]);

  const { data: viewAppointments } = useAppointmentList(statsQuery);
  const counts = useStatusCounts(viewAppointments?.items ?? []);

  const [addOpen, setAddOpen] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTempId, setEditTempId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string | undefined>();
  const [initialTime, setInitialTime] = useState<string | undefined>();
  const [initialDoctorId, setInitialDoctorId] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<"single" | "multi" | null>(null);
  const [deleteSingleId, setDeleteSingleId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKeyword, setDraftKeyword] = useState("");

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
      viewAppointments?.items ?? [],
      [
        { header: t("Common:Patient"), key: "patientName" },
        { header: t("Appointment:Form:Doctor"), key: "doctorName" },
        { header: t("Appointment:Page:StartTime"), key: "startTime", format: (v) => (v ? dayjs(String(v)).format("DD/MM/YYYY HH:mm") : "") },
        { header: t("Appointment:History:Export:AppointmentTime"), key: "endTime", format: (v) => (v ? dayjs(String(v)).format("HH:mm") : "") },
        { header: t("Common:Status"), key: "status" },
        { header: t("Appointment:List:Reason"), key: "reason" },
      ],
      `lich-hen-${state.currentDate.format("YYYY-MM-DD")}`,
    );
  };

  const handleCellClick = (doctorId: string, slotIndex: number) => {
    const totalMinutes = 6 * 60 + slotIndex * filters.slotMinutes;
    const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
    const m = (totalMinutes % 60).toString().padStart(2, "0");
    setInitialDate(state.currentDate.format("YYYY-MM-DD"));
    setInitialTime(`${h}:${m}`);
    setInitialDoctorId(doctorId);
    setEditId(null);
    setAddOpen(true);
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
      toast.success(t("Appointment:Toast:DeleteSuccess"));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteSingleId);
        return next;
      });
    } else if (deleteTarget === "multi") {
      const ids = [...selectedIds];
      await deleteManyMutation.mutateAsync(ids);
      toast.success(t("Appointment:Toast:DeleteMultiSuccess").replace("{0}", String(ids.length)));
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
        const appt = viewAppointments?.items?.find((a) => a.id === id);
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
  }, [handleDeleteSingle, viewAppointments]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return (
    <>
      <div className="cal-page">
        <PageHeader title={t("Appointment:Tab:CustomerCalendar")} />

        <CalendarUnderlineTabs
          activeTab={state.topTab}
          onChange={state.setTopTab}
        />

        {state.topTab === "customer" && ability.canCreate && (
          <div className="mobile-only cal-mobile-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); setAddOpen(true); }}>
              {t("Appointment:Action:Create")}
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setTempOpen(true)}>
              {t("Appointment:Action:CreateTempShort")}
            </Button>
          </div>
        )}

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
              onCreateAppointment={() => { setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); setAddOpen(true); }}
              onCreateTemp={() => setTempOpen(true)}
              onFullscreen={() => setFullscreen(true)}
            />

            {selectedIds.size > 0 && (
              <div className="cal-selection-bar">
                <span className="cal-selection-label">
                  {t("Appointment:Page:SelectedCount").replace("{0}", String(selectedIds.size))}
                </span>
                <div className="cal-selection-actions">
                  <button
                    type="button"
                    className="cal-selection-btn"
                    onClick={handleClearSelection}
                  >
                    {t("Appointment:EventCard:Deselect")}
                  </button>
                  {ability.canDelete && (
                    <button
                      type="button"
                      className="cal-selection-btn cal-selection-btn--danger"
                      onClick={handleDeleteSelected}
                      disabled={deleteMutation.isPending || deleteManyMutation.isPending}
                    >
                      {t("Appointment:Page:DeleteCount").replace("{0}", String(selectedIds.size))}
                    </button>
                  )}
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
                  const totalMinutes = 6 * 60 + slotIdx * filters.slotMinutes;
                  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
                  const m = (totalMinutes % 60).toString().padStart(2, "0");
                  setInitialDate(
                    state.currentDate.startOf("week").add(dayIdx, "day").format("YYYY-MM-DD"),
                  );
                  setInitialTime(`${h}:${m}`);
                  setInitialDoctorId(undefined);
                  setEditId(null);
                  setAddOpen(true);
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
        initialTime={initialTime}
        initialDoctorId={initialDoctorId}
        onClose={() => { setAddOpen(false); setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); }}
        onSuccess={() => { setAddOpen(false); setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); }}
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
        noun={t("Appointment:Page:AppointmentNoun")}
        name={
          deleteTarget === "multi"
            ? t("Appointment:Page:DeleteCount").replace("{0}", String(selectedIds.size))
            : t("Appointment:Page:This")
        }
        pending={deleteMutation.isPending || deleteManyMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={handleCancelDelete}
      />

      {state.topTab === "customer" && (
        <div className="mobile-only cal-mobile-filter">
          <MobileFilterDrawer
            open={filterOpen}
            onOpen={() => { setDraftKeyword(filters.keyword); setFilterOpen(true); }}
            onClose={() => setFilterOpen(false)}
            onClear={() => { setDraftKeyword(""); }}
            onApply={() => { filters.setKeyword(draftKeyword); }}
          >
            <div>
              <div className="mobile-filter-label">{t("Common:Search")}</div>
              <Input
                prefix={<SearchOutlined />}
                placeholder={t("Appointment:Page:SearchPatientPlaceholder")}
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                allowClear
              />
            </div>
          </MobileFilterDrawer>
        </div>
      )}

      {fullscreen && (
        <>
          <CalendarFabs
            onExitFullscreen={() => setFullscreen(false)}
            onCreateTemp={ability.canCreate ? () => setTempOpen(true) : undefined}
            onCreateAppointment={ability.canCreate ? () => { setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); setAddOpen(true); } : undefined}
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
            onCreateAppointment={() => { setEditId(null); setInitialTime(undefined); setInitialDoctorId(undefined); setAddOpen(true); }}
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
