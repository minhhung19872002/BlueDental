import { useEffect, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { createNotificationConnection } from "@/lib/signalr";
import { chatKeys } from "../api/chatQueries";

/** Waits between tries once SignalR's own reconnect has given up: 5 s doubling to 1 min. */
const FIRST_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

/**
 * Keeps the chat current without a reload: the hub sends "ChatChanged" with
 * the conversation id to every member's connections (group `user:{id}`), and
 * the badge, the list and an open thread refetch through the API — the push
 * itself carries no message text.
 *
 * SignalR retries a dropped socket for about 45 s and then closes for good;
 * this keeps trying after that (and after a failed first start) with a
 * growing wait, and refetches once it is back (R-1162 I5.3).
 */
export function useChatLive(enabled: boolean, onChanged?: (conversationId: string) => void): void {
  const queryClient = useQueryClient();
  // The latest callback, without reconnecting the hub when it changes.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  useEffect(() => {
    if (!enabled) return;

    const connection = createNotificationConnection();
    let stopped = false;
    let timer: number | undefined;
    let wait = FIRST_RETRY_MS;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    };
    const scheduleStart = () => {
      if (stopped) return;
      timer = window.setTimeout(() => void start(true), wait);
      wait = Math.min(wait * 2, MAX_RETRY_MS);
    };
    const start = async (isRetry: boolean) => {
      try {
        await connection.start();
        wait = FIRST_RETRY_MS;
        // Whatever arrived while the socket was down is fetched once it is back.
        if (isRetry) refresh();
      } catch (error: unknown) {
        if (stopped) return;
        console.warn("Chat live updates unavailable, retrying:", error);
        scheduleStart();
      }
    };

    connection.on("ChatChanged", (conversationId: unknown) => {
      refresh();
      if (typeof conversationId === "string") onChangedRef.current?.(conversationId);
    });
    connection.onreconnected(refresh);
    connection.onclose(() => scheduleStart());
    void start(false);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, queryClient]);
}
