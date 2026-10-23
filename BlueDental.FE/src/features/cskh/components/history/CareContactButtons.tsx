import { Button, Tooltip } from "antd";
import { MessageOutlined, SendOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAbility } from "@/hooks/useAbility";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useCareOverview } from "../../api/careHistoryApi";
import { MESSAGE_CHANNEL } from "../../api/templateApi";
import { sendPath } from "../../templatePaths";

/**
 * The two buttons BA P2210 adds to the record's Chăm sóc KH tab:
 * "Mở chat Zalo" opens Hộp thư Zalo straight on this customer's conversation;
 * "Gửi tin" opens Gửi tin nhắn on SMS — the channel can still be changed —
 * with this customer picked and locked.
 */
export function CareContactButtons({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const { canRead: canInbox } = useAbility("cskhInbox");
  const { canRead: canSend } = useAbility("cskhSend");
  const overview = useCareOverview(patientId);
  const conversationId = overview.data?.conversationId ?? null;

  const openChat = () =>
    conversationId && navigate(withBranch(`/cskh-grouping?tab=inbox&conversation=${conversationId}`, branchId));
  const openSend = () => navigate(withBranch(sendPath({ channel: MESSAGE_CHANNEL.Sms, patientId }), branchId));

  return (
    <div className="ch-contact">
      {canInbox && (
        <Tooltip title={conversationId ? undefined : t("CSKH:History:NoZaloHint")}>
          <Button icon={<MessageOutlined />} disabled={!conversationId} onClick={openChat}>
            {t("CSKH:History:OpenZalo")}
          </Button>
        </Tooltip>
      )}
      {canSend && (
        <Button type="primary" icon={<SendOutlined />} onClick={openSend}>
          {t("CSKH:History:Send")}
        </Button>
      )}
    </div>
  );
}
