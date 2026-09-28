import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Spin, Switch, Tag } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { formatDateTime } from "@/utils/format";
import {
  useDisconnectZalo,
  useImportZaloBootstrap,
  useRefreshZaloToken,
  useSetZaloEnabled,
  useZaloConnectUrl,
  useZaloStatus,
  type ZaloOaStatusDto,
  type ZaloOaStatusText,
} from "../api/zaloApi";

const STATUS_TAG: Record<ZaloOaStatusText, { color: string; label: string }> = {
  None: { color: "default", label: "Tools:ZaloNotActivated" },
  Active: { color: "green", label: "Tools:ZaloStatusActive" },
  Failed: { color: "red", label: "Tools:ZaloStatusFailed" },
  Expired: { color: "orange", label: "Tools:ZaloStatusExpired" },
};

/** What the OAuth callback appends to the return URL, and the toast each earns. */
const CALLBACK_REASONS: Record<string, string> = {
  "not-configured": "Tools:ZaloCallback:NotConfigured",
  state: "Tools:ZaloCallback:State",
  denied: "Tools:ZaloCallback:Denied",
  exchange: "Tools:ZaloCallback:Exchange",
  "oa-info": "Tools:ZaloCallback:OaInfo",
  "oa-mismatch": "Tools:ZaloCallback:OaMismatch",
};

/**
 * Reads `?zalo=connected|error&reason=…` that the server's OAuth callback
 * redirects back with, reports it once, and strips it so a reload stays quiet.
 */
function useCallbackOutcome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const outcome = searchParams.get("zalo");
  const reason = searchParams.get("reason");
  const message = searchParams.get("message");

  useEffect(() => {
    if (!outcome) return;
    if (outcome === "connected") {
      toast.success(t("Tools:ZaloConnected"));
    } else {
      const key = CALLBACK_REASONS[reason ?? ""] ?? "Tools:ZaloCallback:Unknown";
      notifyError(message ? `${t(key)}: ${message}` : t(key));
    }
    setSearchParams(
      (params) => {
        params.delete("zalo");
        params.delete("reason");
        params.delete("message");
        return params;
      },
      { replace: true },
    );
  }, [outcome, reason, message, setSearchParams]);
}

interface PanelProps {
  status: ZaloOaStatusDto;
  canManage: boolean;
}

function NotConnectedPanel({ status, canManage }: PanelProps) {
  const connectUrl = useZaloConnectUrl();
  const importBootstrap = useImportZaloBootstrap();

  const handleConnect = async () => {
    try {
      const { url } = await connectUrl.mutateAsync();
      window.location.assign(url);
    } catch {
      // queryClient reports the failure
    }
  };

  const handleImport = async () => {
    try {
      await importBootstrap.mutateAsync();
      toast.success(t("Tools:ZaloConnected"));
    } catch {
      // queryClient reports the failure
    }
  };

  return (
    <div className="bd-zalo-panel">
      <div className="bd-zalo-avatar">OA</div>
      <div>
        <div className="bd-zalo-title">{t("Tools:ZaloNotConnected")}</div>
        <Tag color="default" className="bd-zalo-status">
          {t("Tools:ZaloNotActivated")}
        </Tag>
        {status.lastError && <p className="bd-zalo-error">{status.lastError}</p>}
        <div className="bd-zalo-actions">
          <Button
            type="primary"
            disabled={!canManage || !status.canConnect}
            loading={connectUrl.isPending}
            onClick={() => void handleConnect()}
          >
            {t("Tools:ZaloConnect")}
          </Button>
          {status.hasBootstrapTokens && canManage && (
            <Button loading={importBootstrap.isPending} onClick={() => void handleImport()}>
              {t("Tools:ZaloImportBootstrap")}
            </Button>
          )}
        </div>
        {!status.canConnect && <p className="bd-zalo-hint">{t("Tools:ZaloNotConfiguredHint")}</p>}
      </div>
    </div>
  );
}

function ConnectedPanel({ status, canManage }: PanelProps) {
  const setEnabled = useSetZaloEnabled();
  const refreshToken = useRefreshZaloToken();
  const disconnect = useDisconnectZalo();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const tag = STATUS_TAG[status.status];

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabled.mutateAsync(checked);
      toast.success(checked ? t("Tools:ZaloEnabled") : t("Tools:ZaloDisabled"));
    } catch {
      // queryClient reports the failure
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshToken.mutateAsync();
      toast.success(t("Tools:ZaloTokenRefreshed"));
    } catch {
      // queryClient reports the failure
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success(t("Tools:ZaloDisconnected"));
    } catch {
      // queryClient reports the failure
    } finally {
      setConfirmDisconnect(false);
    }
  };

  return (
    <div className="bd-zalo-panel">
      {status.avatarUrl ? (
        <img className="bd-zalo-avatar bd-zalo-avatar--image" src={status.avatarUrl} alt="" />
      ) : (
        <div className="bd-zalo-avatar">OA</div>
      )}
      <div>
        <div className="bd-zalo-title">{status.oaName}</div>
        <Tag color={tag.color} className="bd-zalo-status">
          {t(tag.label)}
        </Tag>
        <dl className="bd-zalo-facts">
          <dt>{t("Tools:ZaloOaId")}</dt>
          <dd>{status.oaId}</dd>
          <dt>{t("Tools:ZaloPackage")}</dt>
          <dd>{status.packageName ?? "—"}</dd>
          <dt>{t("Tools:ZaloConnectedAt")}</dt>
          <dd>{formatDateTime(status.connectedAt)}</dd>
          <dt>{t("Tools:ZaloTokenExpiresAt")}</dt>
          <dd>{formatDateTime(status.accessTokenExpiresAt)}</dd>
        </dl>
        {status.lastError && <p className="bd-zalo-error">{status.lastError}</p>}
        <div className="bd-zalo-toggle">
          <span>{t("Tools:ZaloEnableLabel")}</span>
          <Switch
            checked={status.isEnabled}
            disabled={!canManage}
            loading={setEnabled.isPending}
            aria-label={t("Tools:ZaloEnableLabel")}
            onChange={(checked) => void handleToggle(checked)}
          />
        </div>
        {canManage && (
          <div className="bd-zalo-actions">
            <Button loading={refreshToken.isPending} onClick={() => void handleRefresh()}>
              {t("Tools:ZaloRefreshToken")}
            </Button>
            <Button danger onClick={() => setConfirmDisconnect(true)}>
              {t("Tools:ZaloDisconnect")}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={confirmDisconnect}
        noun={t("Tools:ZaloConnectionNoun")}
        name={status.oaName ?? ""}
        title={t("Tools:ZaloDisconnectTitle")}
        confirmLabel={t("Tools:ZaloDisconnect")}
        pending={disconnect.isPending}
        onConfirm={() => void handleDisconnect()}
        onClose={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}

/** Cấu hình — the Zalo OA connection of the current branch. */
export function ZaloConfigView({ canManage }: { canManage: boolean }) {
  useCallbackOutcome();
  const { data: status, isLoading } = useZaloStatus();

  return (
    <div className="reception-card reception-card--content">
      {isLoading || !status ? (
        <div className="bd-zalo-panel">
          <Spin />
        </div>
      ) : status.isConnected ? (
        <ConnectedPanel status={status} canManage={canManage} />
      ) : (
        <NotConnectedPanel status={status} canManage={canManage} />
      )}
    </div>
  );
}
