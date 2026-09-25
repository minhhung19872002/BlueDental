import { Empty, Spin } from "antd";
import { t } from "@/lib/i18n";
import type { CounterBoard as CounterBoardModel } from "../types";
import { CounterBoardCard } from "./CounterBoardCard";

interface CounterBoardProps {
  counters: CounterBoardModel[];
  loading: boolean;
  canCall: boolean;
  /** The counter whose "Gọi số tiếp theo" is in flight, so only its button spins. */
  callingCounterId: string | null;
  onCallNext: (counterId: string) => void;
}

/** "Các quầy tiếp nhận": one card per counter, paused ones shown dimmed (owner decision). */
export function CounterBoard({
  counters,
  loading,
  canCall,
  callingCounterId,
  onCallNext,
}: CounterBoardProps) {
  return (
    <section className="reception-card queue-board" aria-label={t("Queue:Board:Title")}>
      <h2 className="queue-board__title">{t("Queue:Board:Title")}</h2>
      {loading && counters.length === 0 && (
        <div className="queue-board__loading">
          <Spin />
        </div>
      )}
      {!loading && counters.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Queue:Board:Empty")} />
      )}
      {counters.length > 0 && (
        <div className="queue-board__grid">
          {counters.map((counter, index) => (
            <CounterBoardCard
              key={counter.id}
              counter={counter}
              index={index}
              canCall={canCall}
              calling={callingCounterId === counter.id}
              onCallNext={onCallNext}
            />
          ))}
        </div>
      )}
    </section>
  );
}
