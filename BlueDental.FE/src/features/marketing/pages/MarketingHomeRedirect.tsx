import { Navigate } from "react-router-dom";
import { useAbility } from "@/hooks/useAbility";

/** /marketing opens the first tab the account can read — the menu entry covers both. */
export function MarketingHomeRedirect() {
  const ticket = useAbility("marketingTicket");
  return <Navigate to={ticket.canRead ? "/marketing/tickets" : "/marketing/tags"} replace />;
}
