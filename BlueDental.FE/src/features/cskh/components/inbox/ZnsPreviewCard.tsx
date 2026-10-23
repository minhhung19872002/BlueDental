import { Alert, Button, Spin } from "antd";
import { CloseOutlined, SendOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useSendZns, useZnsPreview, ZNS_BLOCK, type ZnsBlock } from "../../api/inboxApi";
import { missingLabel } from "../../messageVariables";

const BLOCK_TEXT: Record<ZnsBlock, string> = {
  [ZNS_BLOCK.NoPatient]: "CSKH:Inbox:Zns:Block:NoPatient",
  [ZNS_BLOCK.NoPhone]: "CSKH:Inbox:Zns:Block:NoPhone",
  [ZNS_BLOCK.MissingData]: "CSKH:Inbox:Zns:Block:Missing",
  [ZNS_BLOCK.NotConnected]: "CSKH:Inbox:Zns:Block:NotConnected",
};

interface Props {
  conversationId: string;
  templateId: string;
  canSend: boolean;
  onClear: () => void;
}

/**
 * The picked ZNS under the chat, filled with this customer (BA P2210: "Hiển
 * thị tin nhắn xuống dưới khung chat có đổ data người dùng đang chát để user
 * kiểm tra lại"). A ZNS is Zalo's approved layout plus parameters, so the
 * check is each parameter's value; picking another template replaces this one.
 */
export function ZnsPreviewCard({ conversationId, templateId, canSend, onClear }: Props) {
  const preview = useZnsPreview(conversationId, templateId);
  const send = useSendZns();
  const data = preview.data;

  const handleSend = () =>
    send.mutate(
      { id: conversationId, templateId },
      {
        onSuccess: () => {
          toast.success(t("CSKH:Inbox:Zns:SentToast", data?.templateName ?? ""));
          onClear();
        },
      },
    );

  return (
    <section className="ibx-zns-card" aria-label={t("CSKH:Inbox:Zns:PreviewLabel")}>
      <Spin spinning={preview.isFetching}>
        <header className="ibx-zns-card-head">
          <span className="ibx-bubble-tag">{t("CSKH:Inbox:Zns:Tag", data?.templateName ?? "")}</span>
          <Button size="small" type="text" icon={<CloseOutlined />} aria-label={t("CSKH:Inbox:Zns:Clear")} onClick={onClear} />
        </header>
        {data && (
          <>
            <dl className="ibx-zns-params">
              {data.params.map((param) => (
                <div key={param.name} className="ibx-zns-param">
                  <dt>{param.name}</dt>
                  <dd>{param.value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="ibx-zns-foot">
              {[data.phone && t("CSKH:Inbox:Zns:To", data.phone), data.price != null && t("CSKH:Inbox:Zns:Price", formatVND(data.price))]
                .filter(Boolean)
                .join(" · ")}
              {data.previewUrl && /^https?:\/\//i.test(data.previewUrl) && (
                <a href={data.previewUrl} target="_blank" rel="noopener noreferrer" className="ibx-zns-link">
                  {t("CSKH:Inbox:Zns:ViewOnZalo")}
                </a>
              )}
            </p>
            {data.block && (
              <Alert
                type="warning"
                showIcon
                message={t(BLOCK_TEXT[data.block], data.missing.map(missingLabel).join(", "))}
              />
            )}
          </>
        )}
        {preview.isError && <Alert type="error" showIcon message={t("CSKH:Inbox:Zns:PreviewFailed")} />}
        <div className="ibx-zns-actions">
          <Button onClick={onClear}>{t("CSKH:Inbox:Zns:Clear")}</Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={send.isPending}
            disabled={!canSend || !data || data.block != null || send.isPending}
            onClick={handleSend}
          >
            {t("CSKH:Inbox:Zns:Send")}
          </Button>
        </div>
      </Spin>
    </section>
  );
}
