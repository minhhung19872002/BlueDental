import { Button, Spin } from "antd";
import { WifiOff } from "lucide-react";
import { describeApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { readDeviceToken } from "../api/deviceToken";
import { STATION_STAGE, useSigningStation } from "../api/signingStationApi";
import { StationMessage, StationShell } from "../components/StationShell";
import { IdleScreen, NotPairedScreen } from "../components/StationNotices";
import { StationSessionView } from "../components/StationSessionView";
import { useStationLive } from "../hooks/useStationLive";
import "../components/signing-station.css";

/** SigningDeviceNotPaired: the token is unknown or was revoked. */
const NOT_PAIRED = "BlueDental:Billing:0111";

/**
 * /sign — the branch's iPad at the counter (P2610). No staff login: the token
 * saved by the pairing link names the branch. The PC sends a receipt; the hub
 * says when to read the screen again.
 */
export function SigningStationPage() {
  const paired = readDeviceToken() !== null;
  const query = useSigningStation(paired);
  useStationLive(paired);

  if (!paired) return <StationShell clinicName=""><NotPairedScreen /></StationShell>;

  if (query.isPending) {
    return (
      <StationShell clinicName="">
        <div className="sst-loading">
          <Spin size="large" />
        </div>
      </StationShell>
    );
  }

  if (query.isError) {
    const info = describeApiError(query.error);
    if (info.code === NOT_PAIRED) return <StationShell clinicName=""><NotPairedScreen /></StationShell>;
    return (
      <StationShell clinicName="">
        <StationMessage icon={<WifiOff size={40} aria-hidden="true" />} title={t("SigningStation:Error:Title")} text={info.message}>
          <Button size="large" type="primary" onClick={() => void query.refetch()}>
            {t("SigningStation:Error:Retry")}
          </Button>
        </StationMessage>
      </StationShell>
    );
  }

  const station = query.data;
  const { sessionId, paymentCode, receipt } = station;
  if (station.stage === STATION_STAGE.Idle || !sessionId || !paymentCode || !receipt) {
    return (
      <StationShell clinicName={station.clinicName}>
        <IdleScreen />
      </StationShell>
    );
  }

  return <StationSessionView key={sessionId} station={{ ...station, sessionId, paymentCode, receipt }} />;
}
