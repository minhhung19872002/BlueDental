import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n";
import { saveDeviceToken } from "../api/deviceToken";
import { StationMessage, StationShell } from "../components/StationShell";
import "../components/signing-station.css";

/**
 * /sign/pair#<token> — the link shown once in Cài đặt → Kết nối iPad. The
 * token rides after `#`, so the browser never sends it to the server. This page
 * keeps it in this iPad's browser and moves on to /sign, dropping it from the
 * address bar and the history.
 */
export function SigningPairPage() {
  const { hash } = useLocation();
  const token = hash.replace(/^#/, "");
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    setSaved(token.length > 0 && saveDeviceToken(token));
  }, [token]);

  if (saved === null) return null;
  if (saved) return <Navigate to="/sign" replace />;
  return (
    <StationShell clinicName="">
      <StationMessage
        icon={<ShieldAlert size={40} aria-hidden="true" />}
        title={t("SigningStation:Pair:FailTitle")}
        text={t("SigningStation:Pair:FailText")}
      />
    </StationShell>
  );
}
