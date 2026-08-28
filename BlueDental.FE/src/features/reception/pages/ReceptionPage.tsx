import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Spin } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ConfirmCancelDialog } from "@/components/ConfirmCancelDialog";
import { ReceptionToolbar } from "../components/ReceptionToolbar";
import { ReceptionStatusTabs } from "../components/ReceptionStatusTabs";
import { ReceptionCard } from "../components/ReceptionCard";
import { ReceptionEmptyState } from "../components/ReceptionEmptyState";
import { ReceptionNewDrawer } from "../components/ReceptionNewDrawer";
import {
  useReceptionList,
  useReceptionMetrics,
  useReceptionDoctors,
} from "../api/receptionQueries";
import {
  useUpdateReceptionStatus,
  useUpdateReceptionOutcome,
  useUpdateReceptionDoctor,
  useCancelReception,
} from "../api/receptionMutations";
import { t } from "@/lib/i18n";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useDebounce } from "@/hooks/useDebounce";
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
  const branchId = useBranchFilter();
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
  const { data: metrics } = useReceptionMetrics({ date: filter.date, viewMode, branchId });
  const { data: doctors = [] } = useReceptionDoctors(branchId);
  const updateStatusMutation = useUpdateReceptionStatus();
  const updateOutcomeMutation = useUpdateReceptionOutcome();
  const updateDoctorMutation = useUpdateReceptionDoctor();
  const cancelMutation = useCancelReception();

  const items = useMemo(
    () => listData?.pages.flatMap((p) => p.items) ?? [],
    [listData],
  );

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

  const handleStatusChange = (id: string, action: "check-in" | "start" | "complete") => {
    updateStatusMutation.mutate(
      { id, action },
      {
        onSuccess: () => {
          const labels = { "check-in": t("Đã đến"), start: t("Bắt đầu khám"), complete: t("Hoàn tất") };
          toast.success(labels[action]);
        },
        onError: (err) => {
          toast.error(err.message || t("Cập nhật trạng thái thất bại"));
        },
      },
    );
  };

  const handleOutcomeChange = (id: string, outcome: AppointmentOutcome) => {
    updateOutcomeMutation.mutate({ id, outcome });
  };

  const handleDoctorChange = (id: string, doctorId: string) => {
    updateDoctorMutation.mutate({ id, doctorId });
  };

  const handleCancel = (id: string) => {
    const item = items.find((i) => i.id === id);
    setCancelTarget({ id, name: item?.patientName ?? "" });
  };

  const handleCancelConfirm = (reason: string) => {
    if (!cancelTarget) return;
    cancelMutation.mutate(
      { id: cancelTarget.id, reason },
      {
        onSuccess: () => {
          toast.success(t("Đã huỷ lịch hẹn"));
          setCancelTarget(null);
        },
        onError: (err) => {
          toast.error(err.message || t("Huỷ lịch thất bại"));
        },
      },
    );
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
      <div className="reception-card reception-card--toolbar">
        <ReceptionToolbar
          keyword={keyword}
          viewMode={viewMode}
          currentDate={currentDate}
          onSearchChange={setKeyword}
          onViewModeChange={setViewMode}
          onDateChange={setCurrentDate}
          onCreateClick={() => setDrawerOpen(true)}
        />
      </div>

      <div className="reception-card reception-card--tabs">
        <ReceptionStatusTabs
          activeTab={activeTab}
          activeCounter={activeCounter}
          metrics={metrics}
          selectedDoctorId={selectedDoctorId}
          doctors={doctors}
          onChange={(status) => { setActiveTab(status); setActiveCounter(undefined); }}
          onCounterClick={handleCounterClick}
          onDoctorSelect={setSelectedDoctorId}
        />
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
            <div className="reception-card-grid">
              {items.map((item) => (
                <ReceptionCard
                  key={item.id}
                  item={item}
                  doctors={doctors}
                  onStatusChange={handleStatusChange}
                  onOutcomeChange={handleOutcomeChange}
                  onDoctorChange={handleDoctorChange}
                  onCancel={handleCancel}
                />
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
