import { useEffect, useRef } from "react";
import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  HubConnectionState,
  type HubConnection,
} from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { queueKeys } from "../api/queueQueries";

interface TicketCalledPayload {
  id: string;
  displayNumber: string;
  branchId: string;
  callCount: number;
}

interface WaitingTimeWarningPayload {
  branchId: string;
  warningCount: number;
  dangerCount: number;
}

interface UseQueueSignalROptions {
  branchId: string;
  onTicketCalled?: (payload: TicketCalledPayload) => void;
  onWaitingTimeWarning?: (payload: WaitingTimeWarningPayload) => void;
}

export function useQueueSignalR({ branchId, onTicketCalled, onWaitingTimeWarning }: UseQueueSignalROptions) {
  const queryClient = useQueryClient();
  const connRef = useRef<HubConnection | null>(null);
  const callbackRef = useRef(onTicketCalled);
  callbackRef.current = onTicketCalled;
  const warningCallbackRef = useRef(onWaitingTimeWarning);
  warningCallbackRef.current = onWaitingTimeWarning;

  useEffect(() => {
    if (!branchId) return;

    const connection = new HubConnectionBuilder()
      .withUrl("/signalr/queue", {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(
        import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning,
      )
      .build();

    connRef.current = connection;

    const invalidateAll = () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.all });
    };

    connection.on("QueueUpdated", invalidateAll);

    connection.on("TicketCalled", (payload: TicketCalledPayload) => {
      invalidateAll();
      callbackRef.current?.(payload);
    });

    connection.on("WaitingTimeWarning", (payload: WaitingTimeWarningPayload) => {
      invalidateAll();
      warningCallbackRef.current?.(payload);
    });

    connection.onreconnected(() => {
      void connection.invoke("JoinBranch", branchId);
    });

    connection
      .start()
      .then(() => connection.invoke("JoinBranch", branchId))
      .catch((err) => console.error("QueueHub connection failed:", err));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
      connRef.current = null;
    };
  }, [branchId, queryClient]);
}
