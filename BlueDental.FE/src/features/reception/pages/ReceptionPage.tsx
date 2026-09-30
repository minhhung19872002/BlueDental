import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmCancelDialog } from "@/components/ConfirmCancelDialog";
import { MobileFilterDrawer } from "@/components/MobileFilterDrawer";
import { SearchSelect } from "@/components/SearchSelect";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionCard } from "../components/ReceptionCard";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import { FollowUpScheduler } from "../components/FollowUpScheduler";
import {
  planOutcomeClick,
  planStepClick,
  type ReceptionCommand,
  type StepAction,
} from "../utils/receptionFlow";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
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
} from "../types/reception";
import "../components/reception.css";

type ViewMode = "day" | "week" | "month";

export const ReceptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReceptionStatus>("All");
  const [keyword, setKeyword] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [activeCounter, setActiveCounter] = useState<keyof ReceptionCounters | undefined>();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftDoctorId, setDraftDoctorId] = useState<string | undefined>();
  const [busyCards, setBusyCards] = useState<Set<string>>(new Set());
  const [followUpTargetId, setFollowUpTargetId] = useState<string | null>(null);
  const branchId = useBranchFilter();
  const ability = useAbility("reception");
  const debouncedKeyword = useDebounce(keyword);

  const filter: ReceptionFilter = {
    status: activeTab,
    counterFilter: activeCounter,
    keyword: debouncedKeyword,
    doctorId: selectedDoctorId,
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
  const { data: metrics } = useReceptionMetrics({ date: filter.date, viewMode, branchId, doctorId: selectedDoctorId });
  const { data: doctors = [] } = useReceptionDoctors(branchId);
  const updateStatusMutation = useUpdateReceptionStatus();
  const cancelMutation = useCancelReception();
  const assignDentistMutation = useAssignReceptionDentist();
  const setOutcomeMutation = useSetReceptionOutcome();

  const items = useMemo(
    () => listData?.pages.flatMap((p) => p.items) ?? [],
    [listData],
  );

  const adjustedMetrics = useMemo(() => {
    if (!metrics) return metrics;
    const lateCount = items.filter((i) => i.isTimeLate).length;
    return {
      ...metrics,
      counters: { ...metrics.counters, lateCount },
    };
  }, [metrics, items]);

  // Once booked, the picker stays up until the refetch brings the follow-up
  // back, so the card never flashes its old outcome in between.
  const openFollowUpId =
    followUpTargetId && !items.find((i) => i.id === followUpTargetId)?.followUpAt ? followUpTargetId : null;

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
    if (openFollowUpId === id) setFollowUpTargetId(null);
    runCommand(id, planOutcomeClick(item, outcome));
  };

  /** A booked follow-up is changed on the calendar, not re-booked from here. */
  const handleFollowUpClick = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.followUpAt) return;
    setFollowUpTargetId((current) => (current === id ? null : id));
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
      <PageHeader
        title={t("Reception:PageTitle")}
        subtitle={t("Reception:PageSubtitle", currentDate.format("DD/MM/YYYY"))}
      />

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
          metrics={adjustedMetrics}
          selectedDoctorId={selectedDoctorId}
          doctors={doctors}
          onChange={(status) => { setActiveTab(status); setActiveCounter(undefined); }}
          onCounterClick={handleCounterClick}
          onDoctorSelect={setSelectedDoctorId}
        />
      </div>

      <div className="mobile-only mobile-filter-block">
        <MobileFilterDrawer
          open={filterOpen}
          onOpen={() => { setDraftKeyword(keyword); setDraftDoctorId(selectedDoctorId); setFilterOpen(true); }}
          onClose={() => setFilterOpen(false)}
          onClear={() => { setDraftKeyword(""); setDraftDoctorId(undefined); }}
          onApply={() => { setKeyword(draftKeyword); setSelectedDoctorId(draftDoctorId); }}
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
          <div>
            <div className="mobile-filter-label">{t("Reception:Doctor")}</div>
            <SearchSelect
              value={draftDoctorId}
              placeholder={t("Reception:Doctor")}
              allowClear
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(val) => setDraftDoctorId(val)}
              style={{ width: "100%" }}
            />
          </div>
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
            <div className={["reception-card-grid", openFollowUpId && "reception-card-grid--has-expanded"].filter(Boolean).join(" ")}>
              {items.map((item) => (
                <ReceptionCard
                  key={item.id}
                  item={item}
                  doctors={doctors}
                  busy={busyCards.has(item.id)}
                  onStatusChange={ability.canUpdate ? handleStatusChange : undefined}
                  onCancel={ability.canUpdate ? handleCancel : undefined}
                  onOutcomeChange={ability.canUpdate ? handleOutcomeChange : undefined}
                  onDoctorChange={ability.canUpdate ? handleDoctorChange : undefined}
                  onFollowUpClick={ability.canUpdate && ability.canCreate ? handleFollowUpClick : undefined}
                  followUpOpen={openFollowUpId === item.id}
                >
                  {openFollowUpId === item.id && (
                    <FollowUpScheduler
                      appointmentId={item.id}
                      defaultDoctorId={item.doctorId}
                      doctors={doctors}
                      onClose={() => setFollowUpTargetId(null)}
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
        doctors={doctors}
        branchId={branchId}
        scheduledDate={currentDate}
        onClose={() => setDrawerOpen(false)}
      />

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
