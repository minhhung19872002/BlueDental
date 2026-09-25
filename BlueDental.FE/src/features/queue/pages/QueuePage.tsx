import { useState, useCallback } from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { PageHeader } from "@/components/PageHeader";
import { useCounterBoard } from "../api/queueQueries";
import { useCreateQueueTicket, useCallNextQueueTicket } from "../api/queueMutations";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { CounterBoard } from "../components/CounterBoard";
import { CreateTicketModal } from "../components/CreateTicketModal";
import { CounterManagerModal } from "../components/CounterManagerModal";
import type { CreateQueueTicketInput } from "../types";
import "../components/queue.css";

/** Màn hình đợi (BA item 22): the reception counters, each calling from one shared queue. */
export function QueuePage() {
  const branchId = useCurrentBranchId();
  const ability = useAbility("queue");

  const [createOpen, setCreateOpen] = useState(false);
  const [counterManagerOpen, setCounterManagerOpen] = useState(false);

  const { data: board, isLoading: boardLoading } = useCounterBoard();
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

  const handleOpenTv = useCallback(() => {
    window.open(`/queue/display?${new URLSearchParams({ branchId })}`, "_blank");
  }, [branchId]);

  const callingCounterId = callNextMutation.isPending
    ? (callNextMutation.variables?.counterId ?? null)
    : null;

  return (
    <div className="reception-page">
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
              <Button onClick={() => setCounterManagerOpen(true)}>{t("Queue:ManageCounters")}</Button>
            )}
            <Button type="link" onClick={handleOpenTv}>
              {t("Queue:OpenTV")}
            </Button>
          </>
        }
      />

      <CounterBoard
        counters={board ?? []}
        loading={boardLoading}
        canCall={ability.canUpdate}
        callingCounterId={callingCounterId}
        onCallNext={handleCallNext}
      />

      <CreateTicketModal
        open={createOpen}
        loading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <CounterManagerModal open={counterManagerOpen} onClose={() => setCounterManagerOpen(false)} />
    </div>
  );
}
