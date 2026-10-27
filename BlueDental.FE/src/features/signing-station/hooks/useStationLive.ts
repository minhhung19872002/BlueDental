import { useEffect } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { createReceiptSigningConnection } from "@/lib/signalr";
import { stationKeys } from "../api/signingStationApi";
import { readDeviceToken } from "../api/deviceToken";

/** The hub only says "something moved"; the screen is read back through the API. */
export function useStationLive(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = readDeviceToken();
    if (!enabled || !token) return;

    const connection = createReceiptSigningConnection();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: stationKeys.current });
    const join = () => connection.invoke<boolean>("JoinDevice", token).then(refresh);

    connection.on("ReceiptSigningChanged", refresh);
    // A new connection is a new hub member: it joins its branch again.
    connection.onreconnected(() => void join());
    connection
      .start()
      .then(join)
      .catch((error: unknown) => console.warn("iPad live updates unavailable:", error));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, queryClient]);
}
