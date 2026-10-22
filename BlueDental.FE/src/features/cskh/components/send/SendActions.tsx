import { Button } from "antd";
import { SendOutlined } from "@ant-design/icons";
import type { SendAction } from "../../hooks/useSendActions";

/** The CTA, worded with what it will do or what is still missing, and "Gửi thử … tới tôi". */
export function SendActions({ send, test }: { send: SendAction; test: SendAction }) {
  return (
    <div className="snd-actions">
      <Button
        type="primary"
        className="snd-cta"
        icon={<SendOutlined />}
        disabled={send.disabled || send.pending}
        loading={send.pending}
        onClick={send.onClick}
      >
        {send.label}
      </Button>
      <Button
        className="snd-test"
        disabled={test.disabled || test.pending}
        loading={test.pending}
        onClick={test.onClick}
      >
        {test.label}
      </Button>
    </div>
  );
}
