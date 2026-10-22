import { InfoCircleOutlined, LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { MESSAGE_CHANNEL, MESSAGE_CHANNELS, type MessageChannel } from "../../api/templateApi";
import { EditorCard } from "./EditorCard";

interface ChannelCardLook {
  glyph: string;
  i18n: "Sms" | "Zalo" | "Email";
  /** Only Zalo is wired to send for now (owner decision 1); the others say so. */
  sends: boolean;
}

const CHANNEL_CARDS: Record<MessageChannel, ChannelCardLook> = {
  [MESSAGE_CHANNEL.Sms]: { glyph: "SMS", i18n: "Sms", sends: false },
  [MESSAGE_CHANNEL.Zalo]: { glyph: "Zalo", i18n: "Zalo", sends: true },
  [MESSAGE_CHANNEL.Email]: { glyph: "@", i18n: "Email", sends: false },
};

interface ChannelPickerProps {
  channel: MessageChannel;
  /** A saved template keeps its channel. */
  locked: boolean;
  onChange: (channel: MessageChannel) => void;
}

function ChannelCard({
  channel,
  selected,
  disabled,
  onSelect,
}: {
  channel: MessageChannel;
  selected: boolean;
  disabled: boolean;
  onSelect: (channel: MessageChannel) => void;
}) {
  const look = CHANNEL_CARDS[channel];
  const className = ["tpe-channel", selected && "tpe-channel--selected"].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className={className}
      onClick={() => onSelect(channel)}
    >
      <span className="tpe-channel-top">
        <span className="tpe-channel-glyph" aria-hidden="true">
          {look.glyph}
        </span>
        <span className="tpe-channel-radio" aria-hidden="true" />
      </span>
      <span className="tpe-channel-title">{t(`CSKH:Template:${look.i18n}:Title`)}</span>
      <span className="tpe-channel-desc">{t(`CSKH:Template:${look.i18n}:Desc`)}</span>
      <span className="tpe-channel-note">{t(`CSKH:Template:${look.i18n}:Note`)}</span>
      {!look.sends && <span className="tpe-channel-tag">{t("CSKH:Template:NotConnected")}</span>}
    </button>
  );
}

/** Step 1 — Mẫu SMS · Mẫu Zalo · Mẫu Email, one per template. */
export function ChannelPicker({ channel, locked, onChange }: ChannelPickerProps) {
  return (
    <EditorCard
      tone="accent"
      step={1}
      title={t("CSKH:Template:Step1")}
      extra={<span className="tpe-card-hint tpe-card-hint--accent">{t("CSKH:Template:OneChannel")}</span>}
    >
      <div className="tpe-channels" role="radiogroup" aria-label={t("CSKH:Template:Step1")}>
        {MESSAGE_CHANNELS.map((item) => (
          <ChannelCard
            key={item}
            channel={item}
            selected={item === channel}
            disabled={locked && item !== channel}
            onSelect={onChange}
          />
        ))}
      </div>
      <p className="tpe-note">
        {locked ? <LockOutlined /> : <InfoCircleOutlined />}
        {locked ? t("CSKH:Template:ChannelLocked") : t("CSKH:Template:ChangeChannelWarn")}
      </p>
    </EditorCard>
  );
}
