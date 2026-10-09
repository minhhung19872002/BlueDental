import { Button } from "antd";
import { ArrowLeftOutlined, SoundOutlined, StepForwardOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { QueueTicketStatus, type CounterBoard } from "../types";
import { bareDentistName } from "../utils/dentistName";

interface CounterQueueHeaderProps {
  counter: CounterBoard;
  canCall: boolean;
  calling: boolean;
  skipping: boolean;
  onBack: () => void;
  onCallNext: () => void;
  onSkip: (ticketId: string) => void;
}

/**
 * "Hàng chờ · Quầy số 2" with the counter's fixed dentist, Bỏ qua for a
 * number that was called but did not come, and "Gọi số tiếp theo · B008".
 * No Gọi lại (BA).
 */
export function CounterQueueHeader({
  counter,
  canCall,
  calling,
  skipping,
  onBack,
  onCallNext,
  onSkip,
}: CounterQueueHeaderProps) {
  const next = counter.upcoming[0];
  const skippable = counter.current?.status === QueueTicketStatus.Called ? counter.current : null;

  return (
    <div className="page-header queue-detail__header">
      <div className="queue-detail__who">
        <Button icon={<ArrowLeftOutlined />} aria-label={t("Queue:Detail:Back")} onClick={onBack} />
        <span className="queue-card__avatar queue-card__avatar--lg" aria-hidden>
          {counter.numberPrefix}
        </span>
        <div>
          <h1 className="page-header-title">{t("Queue:Detail:Title", counter.name)}</h1>
          <p className="page-header-subtitle">
            {counter.dentistName
              ? t("Queue:Detail:FixedDentist", bareDentistName(counter.dentistName))
              : t("Queue:Card:NoDentist")}
            {!counter.isActive && ` · ${t("Queue:Counter:Paused")}`}
          </p>
        </div>
      </div>
      {canCall && (
        <div className="page-header-actions">
          <Button
            icon={<StepForwardOutlined />}
            disabled={!skippable || skipping}
            loading={skipping}
            onClick={() => skippable && onSkip(skippable.id)}
          >
            {skippable
              ? t("Queue:Detail:SkipNumber", skippable.displayNumber)
              : t("Queue:Detail:Skip")}
          </Button>
          <Button
            type="primary"
            icon={<SoundOutlined />}
            disabled={!counter.isActive || !next || calling}
            loading={calling}
            onClick={onCallNext}
          >
            {next ? t("Queue:Detail:CallNext", next.displayNumber) : t("Queue:Board:NoNext")}
          </Button>
        </div>
      )}
    </div>
  );
}
