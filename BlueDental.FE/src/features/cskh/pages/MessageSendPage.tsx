import { useSearchParams } from "react-router-dom";
import { SendScreen } from "../components/send/SendScreen";
import "../components/cskh.css";
import "../components/cskh-template.css";
import "../components/cskh-template-editor.css";
import "../components/cskh-send.css";

/**
 * /cskh-grouping/send. A row's SMS / Zalo button opens it locked to one
 * customer; another customer starts a fresh screen, not one that still holds
 * the last one's picks.
 */
export function MessageSendPage() {
  const [params] = useSearchParams();
  return <SendScreen key={params.get("patientId") ?? "any"} />;
}
