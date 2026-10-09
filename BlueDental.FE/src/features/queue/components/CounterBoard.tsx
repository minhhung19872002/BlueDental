import { Empty, Spin } from "antd";
import { t } from "@/lib/i18n";
import { useNow } from "@/hooks/useNow";
import type { CounterBoard as CounterBoardModel } from "../types";
import { CounterBoardCard } from "./CounterBoardCard";
import type { CounterCardActionsConfig } from "./CounterCardActions";
import { WaitLegend } from "./WaitBadge";

/** Blue, purple, green — the mockup's card colours, in board order. */
const COUNTER_ACCENTS = 3;

interface CounterBoardProps {
  counters: CounterBoardModel[];
  loading: boolean;
  actions: CounterCardActionsConfig;
}

/**
 * "Các quầy khám": one panel with the colour key in its head and a compact
 * grid that fits ten counters on one screen (5 × 2 at 1920 px).
 */
export function CounterBoard({ counters, loading, actions }: CounterBoardProps) {
  // "Vào khám 08:42 · 6 phút" moves with the clock, not only with the data.
  const now = useNow(
    counters.some((c) => c.current),
    30_000,
  );

  return (
    <section className="queue-board-panel" aria-label={t("Queue:Board:Title")}>
      <header className="queue-board-panel__head">
        <h2 className="queue-board-panel__title">{t("Queue:Board:Title")}</h2>
        <WaitLegend />
      </header>
      <BoardBody counters={counters} loading={loading} now={now} actions={actions} />
    </section>
  );
}

function BoardBody({ counters, loading, now, actions }: CounterBoardProps & { now: number }) {
  if (loading && counters.length === 0) {
    return (
      <div className="queue-board__loading">
        <Spin />
      </div>
    );
  }
  if (counters.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Queue:Board:Empty")} />;
  }

  return (
    <div className="queue-board">
      {counters.map((counter, index) => (
        <CounterBoardCard
          key={counter.id}
          counter={counter}
          accent={index % COUNTER_ACCENTS}
          now={now}
          actions={actions}
        />
      ))}
    </div>
  );
}
