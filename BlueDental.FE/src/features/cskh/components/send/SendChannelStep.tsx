import { InfoCircleOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { SendChannelInfo } from "../../api/sendApi";
import { channelLabels, MESSAGE_CHANNEL, MESSAGE_CHANNELS, type MessageChannel } from "../../api/templateApi";
import { EditorCard } from "../template-editor/EditorCard";

/** The template editor's channel cards, with what each channel sends to and how many templates are ready. */
const CHANNEL_LOOK: Record<MessageChannel, { glyph: string; hint: string }> = {
  [MESSAGE_CHANNEL.Sms]: { glyph: "SMS", hint: "CSKH:Send:Sms:Hint" },
  [MESSAGE_CHANNEL.Zalo]: { glyph: "Zalo", hint: "CSKH:Send:Zalo:Hint" },
  [MESSAGE_CHANNEL.Email]: { glyph: "@", hint: "CSKH:Send:Email:Hint" },
};

interface SendChannelStepProps {
  channel: MessageChannel;
  channels: readonly SendChannelInfo[];
  onChange: (channel: MessageChannel) => void;
}

function ChannelCard({ channel, info, selected, onSelect }: {
  channel: MessageChannel;
  info: SendChannelInfo | undefined;
  selected: boolean;
  onSelect: (channel: MessageChannel) => void;
}) {
  const look = CHANNEL_LOOK[channel];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={["tpe-channel", "snd-channel", selected && "tpe-channel--selected"].filter(Boolean).join(" ")}
      onClick={() => onSelect(channel)}
    >
      <span className="tpe-channel-top">
        <span className="tpe-channel-glyph" aria-hidden="true">
          {look.glyph}
        </span>
        <span className="tpe-channel-radio" aria-hidden="true" />
      </span>
      <span className="tpe-channel-title">{channelLabels()[channel]}</span>
      <span className="tpe-channel-desc">{t(look.hint)}</span>
      <span className="tpe-channel-note">{t("CSKH:Send:ReadyCount", info?.readyCount ?? 0)}</span>
      {!info?.connected && <span className="tpe-channel-tag">{t("CSKH:Template:NotConnected")}</span>}
    </button>
  );
}

/**
 * Step 1 — Kênh gửi. Every channel can be picked to see its templates and who
 * it reaches; only a connected one sends (owner decision 1).
 */
export function SendChannelStep({ channel, channels, onChange }: SendChannelStepProps) {
  return (
    <EditorCard
      tone="accent"
      step={1}
      title={t("CSKH:Send:Channel")}
      extra={<span className="tpe-card-hint tpe-card-hint--accent">{t("CSKH:Send:OneChannel")}</span>}
    >
      <div className="tpe-channels" role="radiogroup" aria-label={t("CSKH:Send:Channel")}>
        {MESSAGE_CHANNELS.map((item) => (
          <ChannelCard
            key={item}
            channel={item}
            info={channels.find((info) => info.channel === item)}
            selected={item === channel}
            onSelect={onChange}
          />
        ))}
      </div>
      <p className="tpe-note">
        <InfoCircleOutlined />
        {t("CSKH:Send:Subtitle")}
      </p>
    </EditorCard>
  );
}
