import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { ConfirmCancelDialog } from "@/components/ConfirmCancelDialog";
import { MobileFilterDrawer } from "@/components/MobileFilterDrawer";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionDoctorFilters } from "../components/ReceptionDoctorFilters";
import { ReceptionCard } from "../components/ReceptionCard";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import { FollowUpScheduler } from "../components/FollowUpScheduler";
import { TemporaryPatientDialog, type TemporaryPatientTarget } from "../components/TemporaryPatientDialog";
import { useOwnDoctorDefault } from "../hooks/useOwnDoctorDefault";
import { rankDoctorIds, useDoctorFilter } from "../hooks/useDoctorFilter";
import { useRefetchWhenDue } from "../hooks/useRefetchWhenDue";
import { usePatientLinkTab } from "@/hooks/usePatientLinkTab";
import {
  planOutcomeClick,
  planStepClick,
  type ReceptionCommand,
  type StepAction,
} from "../utils/receptionFlow";
import { orderForBoard } from "../utils/boardOrder";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
  useReceptionDoctorTeams,
  useAvailableReceptionDoctorsByDay,
} from "../api/receptionQueries";
import {
  useUpdateReceptionStatus,
  useCancelReception,
  useAssignReceptionDentist,
  useSetReceptionOutcome,
} from "../api/receptionMutations";
import { t } from "@/lib/i18n";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useDebounce } from "@/hooks/useDebounce";
import { useAbility } from "@/hooks/useAbility";
import type {
  ReceptionStatus,
  ReceptionFilter,
  ReceptionCounters,
  AppointmentOutcome,
  BookedOutcome,
  ReceptionItem,
} from "../types/reception";
import "../components/reception.css";

type ViewMode = "day" | "week" | "month";

const visitDayOf = (item: ReceptionItem) => dayjs(item.arrivalTime || item.createdAt).format("YYYY-MM-DD");

export const ReceptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReceptionStatus>("All");
  const [keyword, setKeyword] = useState("");
  const doctorFilter = useDoctorFilter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [activeCounter, setActiveCounter] = useState<keyof ReceptionCounters | undefined>();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKeyword, setDraftKeyword] = useState("");
  const draftDoctorFilter = useDoctorFilter();
  const [busyCards, setBusyCards] = useState<Set<string>>(new Set());
  const [bookingTarget, setBookingTarget] = useState<{ id: string; outcome: BookedOutcome } | null>(null);
  const [temporaryTarget, setTemporaryTarget] = useState<TemporaryPatientTarget | null>(null);
  const branchId = useBranchFilter();
  const ability = useAbility("reception");
  const debouncedKeyword = useDebounce(keyword);
  const { data: doctors = [], isSuccess: doctorsLoaded } = useReceptionDoctors(branchId);
  const rankedDoctorIds = useMemo(
    () => rankDoctorIds(doctorFilter.doctorIds, doctors),
    [doctorFilter.doctorIds, doctors],
  );

  const filter: ReceptionFilter = {
    status: activeTab,
    counterFilter: activeCounter,
    keyword: debouncedKeyword,
    doctorIds: rankedDoctorIds,
    doctorTeamId: doctorFilter.teamId,
    branchId,
    date: currentDate.format("YYYY-MM-DD"),
    viewMode,
  };

  const {
    data: listData,
    isLoading: listLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useReceptionList(filter);
  const { data: metrics } = useReceptionMetrics({
    date: filter.date,
    viewMode,
    branchId,
    doctorIds: filter.doctorIds,
    doctorTeamId: filter.doctorTeamId,
  });
  const { data: doctorTeams = [] } = useReceptionDoctorTeams();
  const { selectDoctors } = doctorFilter;
  const selectOwnDoctor = useCallback((id: string) => selectDoctors([id]), [selectDoctors]);
  useOwnDoctorDefault(doctorsLoaded ? doctors : undefined, selectOwnDoctor);
  const patientTab = usePatientLinkTab();
  const updateStatusMutation = useUpdateReceptionStatus();
  const cancelMutation = useCancelReception();
  const assignDentistMutation = useAssignReceptionDentist();
  const setOutcomeMutation = useSetReceptionOutcome();

  const items = useMemo(
    () => orderForBoard(listData?.pages.flatMap((p) => p.items) ?? []),
    [listData],
  );
  useRefetchWhenDue(items);

  // A card's doctor can only be changed to someone not OFF on that visit's day.
  const visitDays = useMemo(
    () => [...new Set(items.map(visitDayOf))].sort(),
    [items],
  );
  const doctorsByDay = useAvailableReceptionDoctorsByDay(branchId, visitDays);

  // Once booked, the picker stays up until the refetch brings the follow-up
  // back, so the card never flashes its old outcome in between.
  const openBooking =
    bookingTarget && !items.find((i) => i.id === bookingTarget.id)?.followUpAt ? bookingTarget : null;

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const markBusy = (id: string) => setBusyCards((s) => new Set(s).add(id));
  const clearBusy = (id: string) => setBusyCards((s) => { const n = new Set(s); n.delete(id); return n; });

  const runCommand = (id: string, command: ReceptionCommand, onSuccess?: () => void) => {
    markBusy(id);
    const options = { onSuccess, onSettled: () => clearBusy(id) };
    if (command.kind === "outcome") {
      setOutcomeMutation.mutate({ id, outcome: command.outcome }, options);
      return;
    }
    updateStatusMutation.mutate({ id, action: command.action, outcome: command.outcome }, options);
  };

  const handleStatusChange = (id: string, action: StepAction) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const labels = { "check-in": t("Reception:StatusArrived"), start: t("Reception:StepStart"), complete: t("Reception:StepComplete") };
    runCommand(id, planStepClick(item, action), () => toast.success(labels[action]));
  };

  const handleCancel = (id: string) => {
    const item = items.find((i) => i.id === id);
    setCancelTarget({ id, name: item?.patientName ?? "" });
  };

  const handleCancelConfirm = (reason: string) => {
    if (!cancelTarget) return;
    const { id } = cancelTarget;
    markBusy(id);
    cancelMutation.mutate(
      { id, reason },
      {
        onSuccess: () => {
          toast.success(t("Reception:CancelSuccess"));
          setCancelTarget(null);
        },
        onSettled: () => clearBusy(id),
      },
    );
  };

  const handleOutcomeChange = (id: string, outcome: AppointmentOutcome) => {
    const item = items.find((i) => i.id === id);
    if (!outcome || !item) return;
    // Picking another outcome backs out of an unbooked follow-up.
    if (openBooking?.id === id) setBookingTarget(null);
    runCommand(id, planOutcomeClick(item, outcome));
  };

  /**
   * "Đã hẹn tiếp" / "Hẹn tái khám" open the picker; the same option again closes
   * it. A booked one is changed on the calendar, not re-booked from here.
   */
  const handleFollowUpClick = (id: string, outcome: BookedOutcome) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.followUpAt) return;
    setBookingTarget((current) => (current?.id === id && current.outcome === outcome ? null : { id, outcome }));
  };

  const handleTemporaryPatientClick = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setTemporaryTarget({
      appointmentId: id,
      prefill: { sourceAppointmentId: id, fullName: item.patientName, phone: item.patientPhone || undefined },
    });
  };

  const handleDoctorChange = (id: string, doctorId: string) => {
    markBusy(id);
    assignDentistMutation.mutate({ id, dentistId: doctorId }, { onSettled: () => clearBusy(id) });
  };

  const handleCounterClick = (counter: keyof ReceptionCounters) => {
    setActiveCounter((prev) => {
      if (prev === counter) return undefined;
      setActiveTab("All");
      return counter;
    });
  };

  return (
    <div className="reception-page">
      {/* BA (R-993): no visible title — the toolbar starts at the top for more board room. */}
      <h1 className="bd-sr-only">{t("Reception:PageTitle")}</h1>

      <div className="reception-card reception-card--toolbar">
        <ReceptionToolbar
          keyword={keyword}
          viewMode={viewMode}
          currentDate={currentDate}
          onSearchChange={setKeyword}
          onViewModeChange={setViewMode}
          onDateChange={setCurrentDate}
          onCreateClick={ability.canCreate ? () => setDrawerOpen(true) : undefined}
        />
      </div>

      <div className="reception-card reception-card--tabs">
        <ReceptionStatusTabs
          activeTab={activeTab}
          activeCounter={activeCounter}
          metrics={metrics}
          onChange={(status) => { setActiveTab(status); setActiveCounter(undefined); }}
          onCounterClick={handleCounterClick}
        >
          <ReceptionDoctorFilters filter={doctorFilter} teams={doctorTeams} doctors={doctors} layout="inline" />
        </ReceptionStatusTabs>
      </div>

      <div className="mobile-only mobile-filter-block">
        <MobileFilterDrawer
          open={filterOpen}
          onOpen={() => { setDraftKeyword(keyword); draftDoctorFilter.reset(doctorFilter); setFilterOpen(true); }}
          onClose={() => setFilterOpen(false)}
          onClear={() => { setDraftKeyword(""); draftDoctorFilter.reset({ doctorIds: [] }); }}
          onApply={() => { setKeyword(draftKeyword); doctorFilter.reset(draftDoctorFilter); }}
        >
          <div>
            <div className="mobile-filter-label">{t("Reception:SearchLabel")}</div>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Reception:SearchPlaceholder")}
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              allowClear
            />
          </div>
          <ReceptionDoctorFilters filter={draftDoctorFilter} teams={doctorTeams} doctors={doctors} layout="stacked" />
        </MobileFilterDrawer>
      </div>

      <div className="reception-card-grid-wrapper">
        {listLoading ? (
          <div className="reception-loading">
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <ReceptionEmptyState />
        ) : (
          <>
            <div className={["reception-card-grid", openBooking && "reception-card-grid--has-expanded"].filter(Boolean).join(" ")}>
              {items.map((item) => (
                <ReceptionCard
                  key={item.id}
                  item={item}
                  doctors={doctorsByDay.get(visitDayOf(item)) ?? []}
                  busy={busyCards.has(item.id)}
                  patientTab={patientTab}
                  onStatusChange={ability.canUpdate ? handleStatusChange : undefined}
                  onCancel={ability.canUpdate ? handleCancel : undefined}
                  onOutcomeChange={ability.canUpdate ? handleOutcomeChange : undefined}
                  onDoctorChange={ability.canUpdate ? handleDoctorChange : undefined}
                  onFollowUpClick={ability.canUpdate && ability.canCreate ? handleFollowUpClick : undefined}
                  pendingBooking={openBooking?.id === item.id ? openBooking.outcome : null}
                  onTemporaryPatientClick={ability.canUpdate ? handleTemporaryPatientClick : undefined}
                >
                  {openBooking?.id === item.id && (
                    <FollowUpScheduler
                      key={openBooking.outcome}
                      appointmentId={item.id}
                      outcome={openBooking.outcome}
                      defaultDoctorId={item.doctorId}
                      branchId={branchId}
                      onClose={() => setBookingTarget(null)}
                    />
                  )}
                </ReceptionCard>
              ))}
            </div>
            <div ref={sentinelRef} className="reception-scroll-sentinel">
              {isFetchingNextPage && (
                <div className="reception-loading reception-loading--more">
                  <Spin />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ReceptionNewDrawer
        open={drawerOpen}
        branchId={branchId}
        scheduledDate={currentDate}
        onClose={() => setDrawerOpen(false)}
      />

      {temporaryTarget && (
        <TemporaryPatientDialog target={temporaryTarget} onClose={() => setTemporaryTarget(null)} />
      )}

      <ConfirmCancelDialog
        open={!!cancelTarget}
        name={cancelTarget?.name ?? ""}
        pending={cancelMutation.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default ReceptionPage;
