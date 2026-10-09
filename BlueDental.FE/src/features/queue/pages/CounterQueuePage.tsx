import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Empty, Spin } from "antd";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { useCounterQueue } from "../api/queueQueries";
import { useCallNextQueueTicket, useSkipQueueTicket } from "../api/queueMutations";
import { useQueueSignalR } from "../hooks/useQueueSignalR";
import { CounterQueueHeader } from "../components/CounterQueueHeader";
import { CounterQueueStats } from "../components/CounterQueueStats";
import { CounterQueueTable } from "../components/CounterQueueTable";
import "../components/queue.css";

/** "Hàng chờ · Quầy số 2" (BA mockup 3): one counter's numbers, waits and estimates. */
export function CounterQueuePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const ability = useAbility("queue");
  const { data: queue, isLoading } = useCounterQueue(id);
  const callNext = useCallNextQueueTicket();
  const skip = useSkipQueueTicket();

  useQueueSignalR({ branchId });

  const handleBack = useCallback(() => navigate("/queue"), [navigate]);
  const handleCallNext = useCallback(() => callNext.mutate({ counterId: id }), [callNext, id]);
  const handleSkip = useCallback((ticketId: string) => skip.mutate(ticketId), [skip]);

  if (isLoading) {
    return (
      <div className="reception-page queue-detail__loading">
        <Spin />
      </div>
    );
  }
  if (!queue) {
    return (
      <div className="reception-page">
        <Empty description={t("Queue:Detail:NotFound")} />
      </div>
    );
  }

  return (
    <div className="reception-page queue-detail">
      <CounterQueueHeader
        counter={queue.counter}
        canCall={ability.canUpdate}
        calling={callNext.isPending}
        skipping={skip.isPending}
        onBack={handleBack}
        onCallNext={handleCallNext}
        onSkip={handleSkip}
      />
      <CounterQueueStats queue={queue} />
      <CounterQueueTable
        rows={queue.waiting}
        thresholdMinutes={queue.counter.waitWarningMinutes}
        loading={false}
      />
    </div>
  );
}
