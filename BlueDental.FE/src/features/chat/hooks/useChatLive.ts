import { useEffect } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { createNotificationConnection } from "@/lib/signalr";
import { chatKeys } from "../api/chatQueries";

/**
 * Keeps the chat current without a reload: the hub sends "ChatChanged" with
 * the conversation id to every member's connections (group `user:{id}`), and
 * the badge, the list and an open thread refetch through the API — the push
 * itself carries no message text.
 */
export function useChatLive(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const connection = createNotificationConnection();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    };

    connection.on("ChatChanged", refresh);
    // Whatever arrived while the socket was down is fetched once it is back.
    connection.onreconnected(refresh);
    connection.start().catch((error: unknown) => {
      console.warn("Chat live updates unavailable:", error);
    });

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, queryClient]);
}
