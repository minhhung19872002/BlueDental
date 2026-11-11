import { useState } from "react";
import { Button, Input, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  usePairXrayDevice,
  useRevokeXrayDevice,
  useXrayDevices,
  xrayServerUrl,
  type XrayDeviceDto,
} from "../api/xrayDeviceApi";

interface Props {
  branchId: string;
  canEdit: boolean;
}

const text = (key: string) => t(`Organization:Xray:${key}`);

function copyText(value: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(text("Copied")))
    .catch(() => toast.error(text("CopyFailed")));
}

/**
 * Cài đặt → Máy X-quang (F-95): pair the PC beside the Vatech machine that runs
 * BlueDental.XrayAgent. The token is shown once, to paste into the agent;
 * "Thu hồi" stops that PC sending pictures.
 */
export function XrayDeviceTab({ branchId, canEdit }: Props) {
  const devices = useXrayDevices(branchId);
  const pair = usePairXrayDevice();
  const revoke = useRevokeXrayDevice();
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<XrayDeviceDto | null>(null);

  const handlePair = () =>
    pair.mutate(
      { clinicBranchId: branchId, name: name.trim() },
      {
        onSuccess: (paired) => {
          setToken(paired.token);
          setName("");
        },
      },
    );

  const handleRevoke = () => {
    if (!revoking) return;
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        toast.success(text("Revoked"));
        setRevoking(null);
      },
    });
  };

  const columns: ColumnsType<XrayDeviceDto> = [
    { title: text("Name"), dataIndex: "name", key: "name" },
    { title: text("Created"), key: "created", render: (_, d) => formatDateTime(d.creationTime) },
    { title: text("LastSeen"), key: "seen", render: (_, d) => (d.lastSeenAt ? formatDateTime(d.lastSeenAt) : "—") },
    {
      title: text("Status"),
      key: "status",
      render: (_, d) => (d.isActive ? <Tag color="green">{text("Active")}</Tag> : <Tag>{text("RevokedTag")}</Tag>),
    },
    ...(canEdit
      ? [{
          title: "",
          key: "actions",
          render: (_: unknown, d: XrayDeviceDto) =>
            d.isActive && (
              <Button danger size="small" onClick={() => setRevoking(d)}>
                {text("Revoke")}
              </Button>
            ),
        }]
      : []),
  ];

  return (
    <div className="ipad-pair">
      <div className="profile-content-title">{text("Title")}</div>
      <p className="ipad-pair-intro">{text("Intro")}</p>

      {canEdit && (
        <div className="ipad-pair-create">
          <Input
            value={name}
            maxLength={100}
            placeholder={text("NamePlaceholder")}
            aria-label={text("Name")}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={handlePair}
          />
          <Button
            type="primary"
            icon={<Plus size={16} aria-hidden="true" />}
            loading={pair.isPending}
            disabled={pair.isPending || !name.trim()}
            onClick={handlePair}
          >
            {text("Create")}
          </Button>
        </div>
      )}

      {token && (
        <section className="ipad-pair-link" aria-label={text("TokenTitle")}>
          <div className="ipad-pair-link-body">
            <strong className="ipad-pair-link-title">
              <KeyRound size={16} aria-hidden="true" />
              {text("TokenTitle")}
            </strong>
            <p>{text("TokenHelp")}</p>
            <label className="xray-pair-label">{text("ServerUrl")}</label>
            <div className="ipad-pair-link-row">
              <Input readOnly value={xrayServerUrl()} aria-label={text("ServerUrl")} />
              <Button icon={<Copy size={16} aria-hidden="true" />} onClick={() => copyText(xrayServerUrl())}>
                {text("Copy")}
              </Button>
            </div>
            <label className="xray-pair-label">{text("Token")}</label>
            <div className="ipad-pair-link-row">
              <Input readOnly value={token} aria-label={text("Token")} data-testid="xray-device-token" />
              <Button icon={<Copy size={16} aria-hidden="true" />} onClick={() => copyText(token)}>
                {text("Copy")}
              </Button>
            </div>
            <p className="ipad-pair-link-warn">{text("TokenOnce")}</p>
          </div>
        </section>
      )}

      <DataTable<XrayDeviceDto>
        columns={columns}
        dataSource={devices.data ?? []}
        rowKey="id"
        loading={devices.isLoading}
        pagination={false}
      />

      <ConfirmDialog
        open={revoking !== null}
        message={t("Organization:Xray:RevokeConfirm", revoking?.name ?? "")}
        confirmLabel={text("Revoke")}
        pending={revoke.isPending}
        onConfirm={handleRevoke}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}
