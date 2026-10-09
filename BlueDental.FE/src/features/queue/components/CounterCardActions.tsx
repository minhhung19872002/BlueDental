import type { MouseEvent } from "react";
import { Button, Tooltip } from "antd";
import { ReloadOutlined, SoundOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { CounterBoard } from "../types";

/** What the board lets a counter card do — one object handed down from the page. */
export interface CounterCardActionsConfig {
  canCall: boolean;
  /** The counter whose call is in flight, so only its button spins. */
  callingCounterId: string | null;
  /** The counter whose ↻ was pressed, so only its icon turns while the board reloads. */
  refreshingCounterId: string | null;
  onCallNext: (counterId: string) => void;
  onRefresh: (counterId: string) => void;
  onOpen: (counterId: string) => void;
}

interface CounterCardActionsProps {
  counter: CounterBoard;
  actions: CounterCardActionsConfig;
}

/** Clicks here must not also open the counter page (the whole card is a link). */
function only(handler: () => void) {
  return (event: MouseEvent) => {
    event.stopPropagation();
    handler();
  };
}

/** "Gọi A013", ↻ Làm mới and the waiting-list button under a counter card. */
export function CounterCardActions({ counter, actions }: CounterCardActionsProps) {
  const next = counter.upcoming[0];
  const calling = actions.callingCounterId === counter.id;
  const refreshing = actions.refreshingCounterId === counter.id;

  return (
    <div className="queue-card__actions">
      {actions.canCall && (
        <Button
          type="primary"
          className="queue-card__call"
          icon={<SoundOutlined />}
          loading={calling}
          disabled={!counter.isActive || !next || calling}
          onClick={only(() => actions.onCallNext(counter.id))}
        >
          {!counter.isActive
            ? t("Queue:Card:PausedCounter")
            : next
              ? t("Queue:Card:Call", next.displayNumber)
              : t("Queue:Board:NoNext")}
        </Button>
      )}
      <Tooltip title={t("Queue:Card:Refresh")}>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          aria-label={t("Queue:Card:Refresh")}
          disabled={refreshing}
          onClick={only(() => actions.onRefresh(counter.id))}
        />
      </Tooltip>
      <Tooltip title={t("Queue:Card:OpenList")}>
        <Button
          icon={<UnorderedListOutlined />}
          aria-label={t("Queue:Card:OpenList")}
          onClick={only(() => actions.onOpen(counter.id))}
        />
      </Tooltip>
    </div>
  );
}
