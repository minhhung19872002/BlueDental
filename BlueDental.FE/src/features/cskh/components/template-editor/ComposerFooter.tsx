import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import { MESSAGE_CHANNEL, type MessageChannel, type MessagePreview } from "../../api/templateApi";

interface ComposerFooterProps {
  channel: MessageChannel;
  /** Measured on the sample customer's values — "sau khi thay biến". */
  preview: MessagePreview | undefined;
  removeDiacritics: boolean;
  readOnly: boolean;
  onRemoveDiacriticsChange: (value: boolean) => void;
}

function counterText(channel: MessageChannel, preview: MessagePreview | undefined): string | null {
  if (!preview) return null;
  const { measure } = preview;
  if (channel === MESSAGE_CHANNEL.Sms && measure) {
    return t("CSKH:Template:SmsCounter", measure.characters, measure.perMessage * measure.segments, measure.segments);
  }
  return t("CSKH:Template:CharCounter", preview.text.length);
}

/** Length after the variables are filled; SMS also offers "Tự bỏ dấu tiếng Việt". */
export function ComposerFooter({ channel, preview, removeDiacritics, readOnly, onRemoveDiacriticsChange }: ComposerFooterProps) {
  const counter = counterText(channel, preview);
  return (
    <div className="tpe-footer">
      <span className="tpe-hint" aria-live="polite">
        {counter}
      </span>
      {channel === MESSAGE_CHANNEL.Sms && (
        <Checkbox
          checked={removeDiacritics}
          disabled={readOnly}
          onChange={(event) => onRemoveDiacriticsChange(event.target.checked)}
        >
          {t("CSKH:Template:RemoveDiacritics")}
        </Checkbox>
      )}
    </div>
  );
}
