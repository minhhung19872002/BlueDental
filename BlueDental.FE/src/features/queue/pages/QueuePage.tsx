import { useState, useCallback, useEffect } from "react";
import { Button, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useTablePagination } from "@/hooks/useTablePagination";
import { PageHeader } from "@/components/PageHeader";
import { DateNavigator } from "@/components/DateNavigator/DateNavigator";
import { useQueueList, useQueueStats, useQueueCounters } from "../api/queueQueries";
import {
  useCreateQueueTicket,
  useCallNextQueueTicket,
  useCallQueueTicket,
  useServeQueueTicket,
  useCompleteQueueTicket,
  useSkipQueueTicket,
  useRecallQueueTicket,
} from "../api/queueMutations";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { QueueStatsBar } from "../components/QueueStatsBar";
import { QueueTicketTable } from "../components/QueueTicketTable";
import { CreateTicketModal } from "../components/CreateTicketModal";
import { CounterManagerModal } from "../components/CounterManagerModal";
import type { CreateQueueTicketInput, QueueTicketStatus as QueueTicketStatusType } from "../types";
import "../components/queue.css";

export function QueuePage() {
  const branchId = useCurrentBranchId();
  const pager = useTablePagination();

  const [date, setDate] = useState<Dayjs>(dayjs());
  const [statusFilter, setStatusFilter] = useState<QueueTicketStatusType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [counterManagerOpen, setCounterManagerOpen] = useState(false);
  const [selectedCounterId, setSelectedCounterId] = useState<string | undefined>(undefined);

  const dateStr = date.format("YYYY-MM-DD");
  const listParams = {
    date: dateStr,
    status: statusFilter ?? undefined,
    counterId: selectedCounterId,
    skipCount: pager.skipCount,
    maxResultCount: pager.maxResultCount,
  };

  const { data: listData, isLoading: listLoading } = useQueueList(listParams);
  const { data: stats, isLoading: statsLoading } = useQueueStats(dateStr, selectedCounterId);
  const { data: counters } = useQueueCounters();

  const createMutation = useCreateQueueTicket();
  const callNextMutation = useCallNextQueueTicket();
  const callMutation = useCallQueueTicket();
  const serveMutation = useServeQueueTicket();
  const completeMutation = useCompleteQueueTicket();
  const skipMutation = useSkipQueueTicket();
  const recallMutation = useRecallQueueTicket();

  const actionLoading =
    callMutation.isPending ||
    serveMutation.isPending ||
    completeMutation.isPending ||
    skipMutation.isPending ||
    recallMutation.isPending ||
    callNextMutation.isPending;

  useQueueSignalR({ branchId });

  const handleCreate = useCallback(
    (values: CreateQueueTicketInput) => {
      createMutation.mutate(values, {
        onSuccess: () => setCreateOpen(false),
      });
    },
    [createMutation],
  );

  const handleStatusClick = useCallback(
    (status: QueueTicketStatusType | null) => {
      setStatusFilter(status);
      pager.resetToFirstPage();
    },
    [pager],
  );

  const activeCounters = (counters ?? []).filter((c) => c.isActive);
  const hasCounters = activeCounters.length > 0;

  useEffect(() => {
    if (hasCounters && !selectedCounterId) {
      setSelectedCounterId(activeCounters[0].id);
    }
  }, [hasCounters, activeCounters, selectedCounterId]);

  const counterInput = { counterId: selectedCounterId };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Queue:PageTitle")}
        subtitle={t("Queue:PageSubtitle")}
        actions={
          <>
            <Button
              type="primary"
              onClick={() => callNextMutation.mutate(counterInput)}
              loading={callNextMutation.isPending}
              disabled={actionLoading}
            >
              {t("Queue:CallNext")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              {t("Queue:NewTicket")}
            </Button>
            <Button onClick={() => setCounterManagerOpen(true)}>
              {t("Queue:ManageCounters")}
            </Button>
            <Button
              type="link"
              onClick={() => {
                const params = new URLSearchParams({ branchId });
                if (selectedCounterId) params.set("counterId", selectedCounterId);
                window.open(`/queue/display?${params.toString()}`, "_blank");
              }}
            >
              {t("Queue:OpenTV")}
            </Button>
          </>
        }
      />

      <QueueStatsBar
        stats={stats}
        loading={statsLoading}
        activeStatus={statusFilter}
        onStatusClick={handleStatusClick}
      />

      <div className="reception-card reception-card--toolbar">
        <div className="filter-toolbar">
          <DateNavigator
            value={date}
            mode="day"
            onChange={(d) => {
              setDate(d);
              pager.resetToFirstPage();
            }}
          />
          {hasCounters && (
            <Select
              placeholder={t("Queue:SelectCounter")}
              value={selectedCounterId}
              onChange={(v) => {
                setSelectedCounterId(v);
                pager.resetToFirstPage();
              }}
              style={{ minWidth: 160 }}
              options={activeCounters.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          )}
        </div>
      </div>

      <div className="page-card" style={{ padding: 0 }}>
        <QueueTicketTable
          data={listData?.items ?? []}
          loading={listLoading}
          paginationConfig={pager.buildConfig(listData?.totalCount)}
          onCall={(id) => callMutation.mutate({ id, input: counterInput })}
          onServe={(id) => serveMutation.mutate(id)}
          onComplete={(id) => completeMutation.mutate(id)}
          onSkip={(id) => skipMutation.mutate(id)}
          onRecall={(id) => recallMutation.mutate({ id, input: counterInput })}
          actionLoading={actionLoading}
        />
      </div>

      <CreateTicketModal
        open={createOpen}
        loading={createMutation.isPending}
        counters={activeCounters}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <CounterManagerModal
        open={counterManagerOpen}
        onClose={() => setCounterManagerOpen(false)}
      />
    </div>
  );
}
