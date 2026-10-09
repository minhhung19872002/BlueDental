import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { PageHeader } from "@/components/PageHeader";
import { useCounterBoard, useQueueCounters } from "../api/queueQueries";
import { useCreateQueueTicket, useCallNextQueueTicket } from "../api/queueMutations";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { BoardSummary } from "../components/BoardSummary";
import { CounterBoard } from "../components/CounterBoard";
import type { CounterCardActionsConfig } from "../components/CounterCardActions";
import { CreateTicketModal } from "../components/CreateTicketModal";
import { CounterManagerModal } from "../components/CounterManagerModal";
import type { CreateQueueTicketInput } from "../types";
import "../components/queue.css";

/** Màn hình đợi (BA item 22, redesign): every counter with its own dentist, numbers and queue. */
export function QueuePage() {
  const branchId = useCurrentBranchId();
  const ability = useAbility("queue");

  const [createOpen, setCreateOpen] = useState(false);
  const [counterManagerOpen, setCounterManagerOpen] = useState(false);
  const [refreshingCounterId, setRefreshingCounterId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { data: board, isLoading: boardLoading, refetch: refetchBoard } = useCounterBoard();
  const { data: counters } = useQueueCounters();
  const createMutation = useCreateQueueTicket();
  const callNextMutation = useCallNextQueueTicket();

  useQueueSignalR({ branchId });

  const handleCreate = useCallback(
    (values: CreateQueueTicketInput) => {
      createMutation.mutate(values, { onSuccess: () => setCreateOpen(false) });
    },
    [createMutation],
  );

  const handleCallNext = useCallback(
    (counterId: string) => callNextMutation.mutate({ counterId }),
    [callNextMutation],
  );

  const handleOpenCounter = useCallback(
    (counterId: string) => navigate(`/queue/counters/${counterId}`),
    [navigate],
  );

  // ↻ on a card: one board request serves every card, only the pressed icon turns.
  const handleRefresh = useCallback(
    async (counterId: string) => {
      setRefreshingCounterId(counterId);
      try {
        await refetchBoard();
      } finally {
        setRefreshingCounterId(null);
      }
    },
    [refetchBoard],
  );

  const handleOpenTv = useCallback(() => {
    window.open(`/queue/display?${new URLSearchParams({ branchId })}`, "_blank");
  }, [branchId]);

  const callingCounterId = callNextMutation.isPending
    ? (callNextMutation.variables?.counterId ?? null)
    : null;

  const cardActions = useMemo<CounterCardActionsConfig>(
    () => ({
      canCall: ability.canUpdate,
      callingCounterId,
      refreshingCounterId,
      onCallNext: handleCallNext,
      onRefresh: handleRefresh,
      onOpen: handleOpenCounter,
    }),
    [
      ability.canUpdate,
      callingCounterId,
      refreshingCounterId,
      handleCallNext,
      handleRefresh,
      handleOpenCounter,
    ],
  );

  return (
    <div className="reception-page queue-page">
      <PageHeader
        title={t("Queue:PageTitle")}
        subtitle={t("Queue:PageSubtitle")}
        actions={
          <>
            {ability.canCreate && (
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                {t("Queue:NewTicket")}
              </Button>
            )}
            {ability.canUpdate && (
              <Button onClick={() => setCounterManagerOpen(true)}>
                {t("Queue:ManageCounters")}
              </Button>
            )}
            <Button type="link" onClick={handleOpenTv}>
              {t("Queue:OpenTV")}
            </Button>
          </>
        }
      />

      <BoardSummary counters={board ?? []} />

      <CounterBoard counters={board ?? []} loading={boardLoading} actions={cardActions} />

      <CreateTicketModal
        open={createOpen}
        loading={createMutation.isPending}
        counters={counters ?? []}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <CounterManagerModal open={counterManagerOpen} onClose={() => setCounterManagerOpen(false)} />
    </div>
  );
}
