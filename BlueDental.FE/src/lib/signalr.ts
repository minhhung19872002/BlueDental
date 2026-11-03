import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

export function createNotificationConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl("/signalr/notifications", {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(
      import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning,
    )
    .build();
}

/** The branch iPad's hub (P2610): no sign-in, the device joins with its token. */
export function createReceiptSigningConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl("/signalr/receipt-signing", {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(
      import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning,
    )
    .build();
}
