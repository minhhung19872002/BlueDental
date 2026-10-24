import { Button, Tooltip } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useRequestInfo } from "../../api/inboxApi";

interface Props {
  conversationId: string;
  /** Zalo's 48 hours since the customer last wrote have run out. */
  disabled: boolean;
}

/**
 * "Xin SĐT" (R-1028): sends Zalo's card again — the customer taps it to share
 * the phone their Zalo is registered with. A refusal reaches the user as the
 * mutation cache's toast.
 */
export function RequestInfoButton({ conversationId, disabled }: Props) {
  const request = useRequestInfo();

  const handleClick = () =>
    request.mutate(conversationId, { onSuccess: () => toast.success(t("CSKH:Inbox:RequestInfoSent")) });

  return (
    <Tooltip title={t("CSKH:Inbox:RequestInfoTip")}>
      <Button
        icon={<PhoneOutlined />}
        loading={request.isPending}
        disabled={disabled || request.isPending}
        onClick={handleClick}
      >
        {t("CSKH:Inbox:RequestInfo")}
      </Button>
    </Tooltip>
  );
}
