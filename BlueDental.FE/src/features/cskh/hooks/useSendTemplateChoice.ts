import { useSendTemplates } from "../api/sendApi";
import { MESSAGE_CHANNEL, TEMPLATE_STATUS, type MessageChannel } from "../api/templateApi";

/**
 * The channel and template the send runs on. "Dùng mẫu này để gửi" brings a
 * template id, which also names the channel when the URL leaves it out; with
 * no usable pick the first "Sẵn sàng" template of the channel is taken (the
 * server lists them first).
 */
export function useSendTemplateChoice(channelParam: MessageChannel | null, templateId: string | null) {
  const templates = useSendTemplates();
  const items = templates.data?.items ?? [];
  const channels = templates.data?.channels ?? [];

  const fromUrl = templateId ? items.find((item) => item.id === templateId) : undefined;
  const channel = channelParam ?? fromUrl?.channel ?? MESSAGE_CHANNEL.Zalo;
  const ofChannel = items.filter((item) => item.channel === channel);
  const picked = fromUrl?.channel === channel && fromUrl.status === TEMPLATE_STATUS.Ready ? fromUrl : undefined;
  const template = picked ?? ofChannel.find((item) => item.status === TEMPLATE_STATUS.Ready) ?? null;

  return {
    loading: templates.isLoading,
    error: templates.error,
    channel,
    channels,
    connected: channels.find((info) => info.channel === channel)?.connected ?? false,
    templates: ofChannel,
    template,
  };
}

export type SendTemplateChoice = ReturnType<typeof useSendTemplateChoice>;
